#!/usr/bin/env python3
"""Batch re-transcribe reels with Gemini Flash audio-only output."""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = ROOT / "sveltekit-app" / "static"
VIDEO_DATA_FILE = STATIC_DIR / "video_data.json"
TRANSCRIPTS_FILE = STATIC_DIR / "reel_transcripts_full.json"
COSMOS_CDN = "https://cdn.cosmos.so"

JSON_PROMPT = """Transcribe ONLY the spoken Japanese audio in this reel.

You are receiving audio only. Do not infer from video, captions, hardsubs, or visual context.

Return strict JSON only with this shape:
{"segments":[{"start_time":0.0,"end_time":1.2,"sentence":"...","words":["..."],"confidence":0.0,"notes":""}]}

Rules:
- Japanese text only. Do not translate.
- Segment by natural spoken phrase or turn, usually 0.5 to 4 seconds.
- Include filler words and casual contractions when audible, e.g. え, ねえ, いんの, やん.
- Do not include visual-only captions or notes such as ※ text unless they are spoken aloud.
- Timestamps should be approximate to 0.1 second and monotonically increasing.
- Each words array must contain clickable Japanese tokens in spoken order.
- Separate particles and quotative endings such as は, が, を, に, で, と, って from neighboring nouns.
- Keep inflected verbs/adjectives together when practical: 叫んで, 言った, 来てない, わかんない.
- Do not split 叫んで into 叫ん + で.
- Put names and loanwords in natural chunks, e.g. 宮下, パーク, ユニコーン.
- Omit punctuation from words entries, but keep punctuation in sentence.
- If a line is unclear, choose the best audible Japanese and lower confidence.
"""

WEBVTT_PROMPT = """Transcribe ONLY the spoken Japanese audio in this reel as WebVTT subtitles.

You are receiving audio only. Do not infer from video, captions, hardsubs, or visual context.

Return valid WebVTT only. Do not return JSON. Do not use Markdown fences.

Rules:
- Start with WEBVTT.
- Each cue must use this format:
  00:00:01.200 --> 00:00:02.900
  Japanese subtitle line
- Japanese text only. Do not translate.
- Segment by natural spoken phrase or turn, usually 0.5 to 4 seconds.
- Include filler words and casual contractions when audible, e.g. え, ねえ, いんの, やん.
- Do not include visual-only captions or notes such as ※ text unless they are spoken aloud.
- Timestamps should be approximate to 0.1 second and monotonically increasing.
- Keep inflected verbs/adjectives together in the subtitle text: 叫んで, 言った, 来てない, わかんない.
- If a line is unclear, choose the best audible Japanese rather than adding explanation.
"""

CHINESE_JSON_PROMPT = """Transcribe ONLY the spoken Mandarin Chinese audio in this reel.

You are receiving audio only. Do not infer from video, captions, hardsubs, or visual context.

Return strict JSON only with this shape:
{"segments":[{"start_time":0.0,"end_time":1.2,"sentence":"...","words":["..."],"confidence":0.0,"notes":""}]}

Rules:
- Chinese text only. Do not translate.
- Segment by natural spoken phrase or turn, usually 0.5 to 4 seconds.
- Include filler words and casual contractions when audible, e.g. 嗯, 啊, 哎, 就是.
- Do not include visual-only captions or notes unless they are spoken aloud.
- Timestamps should be approximate to 0.1 second and monotonically increasing.
- Each words array must contain clickable Chinese word tokens in spoken order.
- Keep multi-character words together when they form one spoken word. Do not split every Hanzi by default.
- Keep names, brands, slang, and loanwords in natural chunks.
- Omit punctuation from words entries, but keep punctuation in sentence.
- If a line is unclear, choose the best audible Chinese and lower confidence.
"""

CHINESE_WEBVTT_PROMPT = """Transcribe ONLY the spoken Mandarin Chinese audio in this reel as WebVTT subtitles.

You are receiving audio only. Do not infer from video, captions, hardsubs, or visual context.

Return valid WebVTT only. Do not return JSON. Do not use Markdown fences.

Rules:
- Start with WEBVTT.
- Each cue must use this format:
  00:00:01.200 --> 00:00:02.900
  Chinese subtitle line
- Chinese text only. Do not translate.
- Segment by natural spoken phrase or turn, usually 0.5 to 4 seconds.
- Include filler words and casual contractions when audible, e.g. 嗯, 啊, 哎, 就是.
- Do not include visual-only captions or notes unless they are spoken aloud.
- Timestamps should be approximate to 0.1 second and monotonically increasing.
- Keep multi-character words together in the subtitle text when they form one spoken word.
- If a line is unclear, choose the best audible Chinese rather than adding explanation.
"""

PROMPTS = {
    "japanese": {
        "json": JSON_PROMPT,
        "vtt": WEBVTT_PROMPT,
    },
    "chinese": {
        "json": CHINESE_JSON_PROMPT,
        "vtt": CHINESE_WEBVTT_PROMPT,
    },
}

PUNCT_RE = re.compile(r"^[\s、。！？!?「」『』（）()［］\\[\\]…・,.]+|[\s、。！？!?「」『』（）()［］\\[\\]…・,.]+$")
WEBVTT_TIME_RE = re.compile(r"(?P<start>\S+)\s*-->\s*(?P<end>\S+)")


def prompt_for(language: str, response_format: str) -> str:
    return PROMPTS[language][response_format]


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        os.environ.setdefault(name.strip(), value.strip().strip("\"").strip("'"))


def response_text(response: dict) -> str:
    text = "".join(
        part.get("text", "")
        for part in response.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    ).strip()
    return text


def parse_json_response(response: dict) -> dict:
    text = response_text(response)
    if text.startswith("```"):
        text = text.removeprefix("```json").removeprefix("```").strip()
        text = text.removesuffix("```").strip()
    return json.loads(text)


def read_http_error(exc: HTTPError) -> str:
    try:
        return exc.read().decode("utf-8")
    except Exception:
        return str(exc)


def download_video(video_id: str, video_url: str | None, out_path: Path) -> None:
    if out_path.exists() and out_path.stat().st_size > 1000:
        return
    url = video_url or f"{COSMOS_CDN}/{video_id}.mp4"
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=120) as response, open(out_path, "wb") as out:
        shutil.copyfileobj(response, out)
    if out_path.stat().st_size < 1000:
        raise RuntimeError(f"downloaded video is too small: {out_path}")


def extract_audio(video_path: Path, audio_path: Path) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(video_path),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            str(audio_path),
        ],
        check=True,
    )


def clean_words(words: object, sentence: str) -> list[str]:
    if not isinstance(words, list):
        return fallback_words(sentence)
    cleaned: list[str] = []
    for word in words:
        text = PUNCT_RE.sub("", str(word).strip())
        if text:
            cleaned.append(text)
    return merge_inflection_fragments(cleaned) or fallback_words(sentence)


def merge_inflection_fragments(words: list[str]) -> list[str]:
    merged: list[str] = []
    index = 0
    while index < len(words):
        word = words[index]
        nxt = words[index + 1] if index + 1 < len(words) else ""
        if word.endswith(("ん", "っ")) and nxt in {"で", "て", "だ", "た"}:
            merged.append(word + nxt)
            index += 2
            continue
        merged.append(word)
        index += 1
    return merged


def fallback_words(sentence: str) -> list[str]:
    tokens = re.findall(r"[一-龯々〆ヵヶぁ-ゖァ-ヺーA-Za-z0-9]+", sentence)
    return [token for token in tokens if token]


def parse_webvtt_time(value: str) -> float:
    text = value.strip().strip("*`").replace(",", ".")
    parts = text.split(":")
    if len(parts) == 3:
        first, second, third = parts
        if "." not in third and len(third) <= 3:
            # Gemini sometimes emits MM:SS:mmm, e.g. 00:02:900.
            return int(first) * 60 + int(second) + int(third) / (10 ** len(third))
        hours, minutes, seconds = first, second, third
    elif len(parts) == 2:
        hours = "0"
        minutes, seconds = parts
    else:
        raise ValueError(f"invalid WebVTT timestamp: {value}")
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def parse_webvtt(text: str, duration: float | None = None, allow_empty: bool = False) -> list[dict]:
    lines = [
        line.strip()
        for line in text.replace("\ufeff", "").splitlines()
        if line.strip() and not line.strip().startswith("NOTE")
    ]
    segments: list[dict] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        if line.upper() == "WEBVTT" or line.isdigit():
            index += 1
            continue
        match = WEBVTT_TIME_RE.search(line)
        if not match:
            index += 1
            continue
        start = parse_webvtt_time(match.group("start"))
        end = parse_webvtt_time(match.group("end"))
        index += 1
        cue_lines: list[str] = []
        while index < len(lines) and not WEBVTT_TIME_RE.search(lines[index]):
            if lines[index].upper() != "WEBVTT" and not lines[index].isdigit():
                cue_lines.append(lines[index])
            index += 1
        sentence = " ".join(cue_lines).strip()
        if not sentence:
            continue
        if end < start:
            end = start
        if duration is not None:
            start = min(max(start, 0.0), duration)
            end = min(max(end, start), duration)
        segments.append({
            "start_time": round(start, 3),
            "end_time": round(end, 3),
            "sentence": sentence,
            "words": clean_words(None, sentence),
            "confidence": 0.9,
        })
    if not segments and allow_empty:
        return []
    if not segments:
        raise RuntimeError("Gemini returned no usable WebVTT cues")
    return segments


def normalize_segments(parsed: dict, duration: float | None = None, allow_empty: bool = False) -> list[dict]:
    raw_segments = parsed.get("segments") or parsed.get("subtitles") or []
    if not isinstance(raw_segments, list):
        raise RuntimeError("Gemini response did not contain a segments array")

    segments: list[dict] = []
    previous_end = 0.0
    for raw in raw_segments:
        if not isinstance(raw, dict):
            continue
        sentence = str(raw.get("sentence") or raw.get("text") or "").strip()
        if not sentence:
            continue
        start = float(raw.get("start_time", raw.get("start", previous_end)) or previous_end)
        end = float(raw.get("end_time", raw.get("end", start)) or start)
        if end < start:
            end = start
        if start < previous_end - 0.4:
            start = previous_end
        if duration is not None:
            start = min(max(start, 0.0), duration)
            end = min(max(end, start), duration)
        segment = {
            "start_time": round(start, 3),
            "end_time": round(end, 3),
            "sentence": sentence,
            "words": clean_words(raw.get("words"), sentence),
        }
        if raw.get("confidence") is not None:
            try:
                segment["confidence"] = round(float(raw["confidence"]), 3)
            except (TypeError, ValueError):
                pass
        if "confidence" not in segment:
            segment["confidence"] = 0.9
        segments.append(segment)
        previous_end = max(previous_end, end)

    if not segments and allow_empty:
        return []
    if not segments:
        raise RuntimeError("Gemini returned no usable transcript segments")
    return segments


def post_gemini_audio(audio_path: Path, model: str, prompt: str, generation_config: dict) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("missing GEMINI_API_KEY")

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "audio/wav",
                            "data": base64.b64encode(audio_path.read_bytes()).decode("ascii"),
                        }
                    },
                ]
            }
        ],
        "generationConfig": generation_config,
    }
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    req = Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=240) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code}: {read_http_error(exc)}") from exc


def transcribe_gemini_json(
    audio_path: Path,
    model: str,
    duration: float | None,
    language: str,
    allow_empty: bool = False,
) -> tuple[list[dict], dict]:
    raw = post_gemini_audio(
        audio_path,
        model,
        prompt_for(language, "json"),
        {
            "temperature": 0.0,
            "responseMimeType": "application/json",
            "maxOutputTokens": 16384,
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "segments": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "start_time": {"type": "NUMBER"},
                                "end_time": {"type": "NUMBER"},
                                "sentence": {"type": "STRING"},
                                "words": {"type": "ARRAY", "items": {"type": "STRING"}},
                                "confidence": {"type": "NUMBER"},
                                "notes": {"type": "STRING"},
                            },
                            "required": ["start_time", "end_time", "sentence", "words"],
                        },
                    }
                },
                "required": ["segments"],
            },
        },
    )
    parsed = parse_json_response(raw)
    return normalize_segments(parsed, duration=duration, allow_empty=allow_empty), raw


def transcribe_gemini_vtt(
    audio_path: Path,
    model: str,
    duration: float | None,
    language: str,
    allow_empty: bool = False,
) -> tuple[list[dict], dict]:
    raw = post_gemini_audio(
        audio_path,
        model,
        prompt_for(language, "vtt"),
        {
            "temperature": 0.0,
            "maxOutputTokens": 8192,
        },
    )
    text = response_text(raw)
    if text.startswith("```"):
        text = text.removeprefix("```webvtt").removeprefix("```vtt").removeprefix("```").strip()
        text = text.removesuffix("```").strip()
    return parse_webvtt(text, duration=duration, allow_empty=allow_empty), {"text": text, "raw": raw}


def offset_segments(segments: list[dict], offset: float, total_duration: float | None) -> list[dict]:
    shifted: list[dict] = []
    for segment in segments:
        start = float(segment["start_time"]) + offset
        end = float(segment["end_time"]) + offset
        if total_duration is not None:
            start = min(max(start, 0.0), total_duration)
            end = min(max(end, start), total_duration)
        shifted_segment = dict(segment)
        shifted_segment["start_time"] = round(start, 3)
        shifted_segment["end_time"] = round(end, 3)
        shifted.append(shifted_segment)
    return shifted


def extract_audio_chunk(audio_path: Path, chunk_path: Path, start: float, duration: float) -> None:
    chunk_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-ss",
            str(start),
            "-t",
            str(duration),
            "-i",
            str(audio_path),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            str(chunk_path),
        ],
        check=True,
    )


def transcribe_audio(
    audio_path: Path,
    model: str,
    duration: float | None,
    args: argparse.Namespace,
    chunk_dir: Path,
) -> tuple[list[dict], dict]:
    if duration is None or duration <= args.chunk_threshold:
        if args.response_format == "vtt":
            return transcribe_gemini_vtt(audio_path, model, duration, args.language)
        return transcribe_gemini_json(audio_path, model, duration, args.language)

    all_segments: list[dict] = []
    raw_chunks: list[dict] = []
    start = 0.0
    chunk_index = 0
    total_chunks = int((duration + args.chunk_seconds - 0.001) // args.chunk_seconds)
    while start < duration:
        chunk_duration = min(args.chunk_seconds, duration - start)
        chunk_path = chunk_dir / f"chunk-{chunk_index:03d}.wav"
        print(f"    chunk {chunk_index + 1}/{total_chunks} start={round(start, 1)}s", flush=True)
        extract_audio_chunk(audio_path, chunk_path, start, chunk_duration)
        if args.response_format == "vtt":
            segments, raw = transcribe_gemini_vtt(chunk_path, model, chunk_duration, args.language, allow_empty=True)
        else:
            segments, raw = transcribe_gemini_json(chunk_path, model, chunk_duration, args.language, allow_empty=True)
        shifted = offset_segments(segments, start, duration)
        all_segments.extend(shifted)
        raw_chunks.append({
            "index": chunk_index,
            "start_time": round(start, 3),
            "duration": round(chunk_duration, 3),
            "segments": shifted,
            "raw": raw,
        })
        chunk_path.unlink(missing_ok=True)
        start += chunk_duration
        chunk_index += 1

    if not all_segments:
        raise RuntimeError("Gemini returned no usable transcript segments for any audio chunk")
    all_segments.sort(key=lambda segment: (segment["start_time"], segment["end_time"]))
    return all_segments, {"chunked": True, "chunk_seconds": args.chunk_seconds, "chunks": raw_chunks}


def get_audio_duration(audio_path: Path) -> float | None:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(audio_path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        return float(result.stdout.strip())
    except (subprocess.CalledProcessError, ValueError):
        return None


def save_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    tmp_path.replace(path)


def process_video(video_id: str, info: dict, args: argparse.Namespace, work_dir: Path) -> tuple[list[dict], dict]:
    video_path = work_dir / "videos" / f"{video_id}.mp4"
    audio_path = work_dir / "audio" / f"{video_id}.wav"
    raw_path = work_dir / "raw" / f"{video_id}.gemini.json"
    chunk_dir = work_dir / "chunks" / video_id
    video_path.parent.mkdir(parents=True, exist_ok=True)
    audio_path.parent.mkdir(parents=True, exist_ok=True)
    raw_path.parent.mkdir(parents=True, exist_ok=True)

    if not args.redownload:
        download_video(video_id, info.get("url"), video_path)
    else:
        if video_path.exists():
            video_path.unlink()
        download_video(video_id, info.get("url"), video_path)

    extract_audio(video_path, audio_path)
    duration = get_audio_duration(audio_path) or info.get("duration")

    last_error: Exception | None = None
    for attempt in range(1, args.retries + 1):
        try:
            segments, raw = transcribe_audio(audio_path, args.model, duration, args, chunk_dir)
            raw_path.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n")
            return segments, raw
        except Exception as exc:
            last_error = exc
            if attempt < args.retries:
                wait = min(45, args.retry_sleep * attempt)
                print(f"    retry {attempt}/{args.retries - 1} after error: {exc}", flush=True)
                time.sleep(wait)
    raise RuntimeError(str(last_error))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video-data", type=Path, default=VIDEO_DATA_FILE)
    parser.add_argument("--output", type=Path, default=TRANSCRIPTS_FILE)
    parser.add_argument("--work-dir", type=Path, default=Path("/tmp/kiokun-gemini-reels"))
    parser.add_argument("--dotenv", type=Path, default=ROOT / ".env")
    parser.add_argument("--model", default="gemini-2.5-flash")
    parser.add_argument("--language", choices=sorted(PROMPTS), default="japanese")
    parser.add_argument("--response-format", choices=["json", "vtt"], default="json")
    parser.add_argument("--force", action="store_true", help="Retranscribe videos even when output already has segments")
    parser.add_argument("--limit", type=int, help="Process at most this many videos")
    parser.add_argument("--only", action="append", default=[], help="Specific video id to process; may be repeated")
    parser.add_argument("--ids-file", action="append", type=Path, default=[], help="File with one video id per line; may be repeated")
    parser.add_argument("--start-after", help="Skip videos until after this id in video_data order")
    parser.add_argument("--sleep", type=float, default=0.2, help="Seconds to sleep after each successful request")
    parser.add_argument("--retry-sleep", type=float, default=3.0)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--chunk-threshold", type=float, default=45.0, help="Chunk audio longer than this many seconds")
    parser.add_argument("--chunk-seconds", type=float, default=30.0, help="Chunk length for long audio")
    parser.add_argument("--redownload", action="store_true")
    parser.add_argument("--keep-video", action="store_true")
    parser.add_argument("--keep-audio", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    load_dotenv(args.dotenv)
    args.work_dir.mkdir(parents=True, exist_ok=True)

    video_data = json.loads(args.video_data.read_text())
    videos: dict[str, dict] = video_data["videos"]
    transcripts: dict[str, list[dict]] = {}
    if args.output.exists():
        transcripts = json.loads(args.output.read_text())

    ids = list(videos)
    wanted_ids = set(args.only)
    for ids_file in args.ids_file:
        wanted_ids.update(
            line.strip()
            for line in ids_file.read_text().splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        )
    if wanted_ids:
        wanted = wanted_ids
        ids = [video_id for video_id in ids if video_id in wanted]
    if args.start_after:
        if args.start_after in ids:
            ids = ids[ids.index(args.start_after) + 1:]
        else:
            raise RuntimeError(f"--start-after id not found: {args.start_after}")
    if not args.force:
        ids = [video_id for video_id in ids if not transcripts.get(video_id)]
    if args.limit is not None:
        ids = ids[:args.limit]

    total_seconds = sum((videos[video_id].get("duration") or 0) for video_id in ids)
    print(f"model={args.model}")
    print(f"language={args.language}")
    print(f"response_format={args.response_format}")
    print(f"output={args.output}")
    print(f"selected={len(ids)} videos, {round(total_seconds / 3600, 2)} hours audio")
    if not ids:
        return 0

    failures: dict[str, str] = {}
    for index, video_id in enumerate(ids, start=1):
        info = videos[video_id]
        duration = info.get("duration")
        print(f"[{index}/{len(ids)}] {video_id} duration={duration}", flush=True)
        try:
            segments, _raw = process_video(video_id, info, args, args.work_dir)
            transcripts[video_id] = segments
            save_json(args.output, transcripts)
            print(f"    ok segments={len(segments)}", flush=True)
        except Exception as exc:
            failures[video_id] = str(exc)
            print(f"    failed: {exc}", flush=True)
        finally:
            if not args.keep_audio:
                audio_path = args.work_dir / "audio" / f"{video_id}.wav"
                audio_path.unlink(missing_ok=True)
            if not args.keep_video:
                video_path = args.work_dir / "videos" / f"{video_id}.mp4"
                video_path.unlink(missing_ok=True)
        if args.sleep:
            time.sleep(args.sleep)

    if failures:
        failure_path = args.work_dir / "failures.json"
        failure_path.write_text(json.dumps(failures, ensure_ascii=False, indent=2) + "\n")
        print(f"failures={len(failures)} written to {failure_path}", file=sys.stderr)
        return 1

    print(f"done: {len(ids)} processed, output videos={len(transcripts)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
