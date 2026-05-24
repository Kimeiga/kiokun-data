#!/usr/bin/env python3
"""Run audio-only ASR experiments for a reel and output comparison tracks."""

from __future__ import annotations

import argparse
import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


COSMOS_CDN = "https://cdn.cosmos.so"

GEMINI_AUDIO_PROMPT = """Transcribe ONLY the spoken Japanese audio in this clip.

You are receiving audio only. Do not infer from video, subtitles, hardsubs, captions, or visual context.

Rules:
- Output Japanese text only in each text field. Do not translate.
- Segment by natural speech turn or phrase.
- Include filler words and casual contractions when audible, e.g. いんの, やん, ねえ.
- If speech overlaps or is unclear, choose the best audible Japanese and put uncertainty in notes.
- Do not include visual-only notes such as ※ captions because they are not spoken audio.
- Timestamps can be approximate to the nearest 0.1 second.
- Return strict JSON only with this shape:
{"subtitles":[{"start_time":0.0,"end_time":1.2,"text":"...","confidence":0.0,"notes":""}],"summary":""}"""


PROVIDERS = {
    "gemini-25-flash-audio": {
        "track_id": "gemini-25-flash-audio-only",
        "label": "Gemini 2.5 Flash audio-only",
        "source": "Audio-only prompt; no video frames or hardsubs provided",
        "kind": "audio-stt",
        "model": "gemini-2.5-flash",
    },
    "gemini-25-flash-lite-audio": {
        "track_id": "gemini-25-flash-lite-audio-only",
        "label": "Gemini 2.5 Flash-Lite audio-only",
        "source": "Audio-only prompt; no video frames or hardsubs provided",
        "kind": "audio-stt",
        "model": "gemini-2.5-flash-lite",
    },
    "deepgram-nova3": {
        "track_id": "deepgram-nova3",
        "label": "Deepgram Nova-3",
        "source": "Deepgram Nova-3 prerecorded audio transcription",
        "kind": "audio-stt",
        "model": "nova-3",
    },
}


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        os.environ.setdefault(name.strip(), value.strip().strip("\"").strip("'"))


def is_probable_video_id(value: str) -> bool:
    return len(value) == 36 and all(char in "0123456789abcdefABCDEF-" for char in value)


def resolve_video(video_arg: str, work_dir: Path) -> tuple[Path, str]:
    path = Path(video_arg).expanduser()
    if path.exists():
        return path, path.stem

    url = f"{COSMOS_CDN}/{video_arg}.mp4" if is_probable_video_id(video_arg) else video_arg
    video_id = Path(url.split("?")[0]).stem
    out_path = work_dir / f"{video_id}.mp4"
    if out_path.exists() and out_path.stat().st_size > 1000:
        return out_path, video_id

    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urlopen(req, timeout=90) as response, open(out_path, "wb") as out:
            shutil.copyfileobj(response, out)
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError(f"failed to download {url}: {exc}") from exc

    if out_path.stat().st_size < 1000:
        raise RuntimeError(f"downloaded video is too small: {out_path}")
    return out_path, video_id


def extract_audio(video_path: Path, audio_path: Path) -> None:
    audio_path.parent.mkdir(parents=True, exist_ok=True)
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


def normalize_segments(raw_segments: list[dict]) -> list[dict]:
    segments: list[dict] = []
    for segment in raw_segments:
        start = float(segment.get("start_time", segment.get("start", 0)) or 0)
        end = float(segment.get("end_time", segment.get("end", start)) or start)
        text = str(segment.get("text") or segment.get("transcript") or "").strip()
        if not text:
            continue
        normalized = {
            "start_time": round(start, 3),
            "end_time": round(end, 3),
            "text": text,
        }
        if segment.get("confidence") is not None:
            normalized["confidence"] = segment.get("confidence")
        if segment.get("notes"):
            normalized["notes"] = str(segment["notes"])
        segments.append(normalized)
    return segments


def parse_gemini_json_text(response: dict) -> dict:
    text = "".join(
        part.get("text", "")
        for part in response.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    ).strip()
    if text.startswith("```"):
        text = text.removeprefix("```json").removeprefix("```").strip()
        text = text.removesuffix("```").strip()
    return json.loads(text)


def transcribe_gemini(audio_path: Path, model: str) -> tuple[list[dict], dict]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("missing GEMINI_API_KEY")

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": GEMINI_AUDIO_PROMPT},
                    {
                        "inline_data": {
                            "mime_type": "audio/wav",
                            "data": base64.b64encode(audio_path.read_bytes()).decode("ascii"),
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.0,
            "responseMimeType": "application/json",
        },
    }
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    req = Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(req, timeout=180) as response:
        raw = json.loads(response.read().decode("utf-8"))
    parsed = parse_gemini_json_text(raw)
    return normalize_segments(parsed.get("subtitles", [])), raw


def transcribe_deepgram(audio_path: Path, language: str, keyterms: list[str]) -> tuple[list[dict], dict]:
    api_key = os.environ.get("DEEPGRAM_API_KEY")
    if not api_key:
        raise RuntimeError("missing DEEPGRAM_API_KEY")

    query = {
        "model": "nova-3",
        "language": language,
        "smart_format": "true",
        "punctuate": "true",
        "utterances": "true",
        "filler_words": "true",
    }
    params = urllib.parse.urlencode(query)
    keyterm_params = "".join(f"&keyterm={urllib.parse.quote(keyterm)}" for keyterm in keyterms)
    endpoint = f"https://api.deepgram.com/v1/listen?{params}{keyterm_params}"
    req = Request(
        endpoint,
        data=audio_path.read_bytes(),
        headers={
            "Authorization": f"Token {api_key}",
            "Content-Type": "audio/wav",
        },
        method="POST",
    )
    with urlopen(req, timeout=180) as response:
        raw = json.loads(response.read().decode("utf-8"))

    utterances = raw.get("results", {}).get("utterances") or []
    if utterances:
        return normalize_segments(utterances), raw

    alternative = (
        raw.get("results", {})
        .get("channels", [{}])[0]
        .get("alternatives", [{}])[0]
    )
    transcript = alternative.get("transcript", "").strip()
    if not transcript:
        return [], raw

    duration = raw.get("metadata", {}).get("duration", 0)
    return [
        {
            "start_time": 0,
            "end_time": round(float(duration or 0), 3),
            "text": transcript,
            "confidence": alternative.get("confidence"),
        }
    ], raw


def make_track(provider: str, segments: list[dict]) -> dict:
    meta = PROVIDERS[provider]
    return {
        "id": meta["track_id"],
        "label": meta["label"],
        "source": meta["source"],
        "kind": meta["kind"],
        "segments": segments,
    }


def update_fixture(fixture_path: Path, track: dict, after_track_id: str | None) -> None:
    fixture = json.loads(fixture_path.read_text())
    tracks = [existing for existing in fixture.get("tracks", []) if existing.get("id") != track["id"]]
    insert_at = len(tracks)
    if after_track_id:
        for index, existing in enumerate(tracks):
            if existing.get("id") == after_track_id:
                insert_at = index + 1
                break
    tracks.insert(insert_at, track)
    fixture["tracks"] = tracks
    fixture_path.write_text(json.dumps(fixture, ensure_ascii=False, indent=2) + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", help="Local video path, Cosmos video id, or video URL")
    parser.add_argument("--provider", choices=sorted(PROVIDERS), required=True)
    parser.add_argument("--work-dir", type=Path, default=Path("/tmp/kiokun-asr-reel"))
    parser.add_argument("--audio", type=Path, help="Use an existing WAV file instead of extracting from video")
    parser.add_argument("--output", "-o", type=Path, help="Write normalized provider output JSON here")
    parser.add_argument("--fixture", type=Path, help="Append/update track in this comparison fixture JSON")
    parser.add_argument("--after-track-id", help="When updating a fixture, insert after this track id")
    parser.add_argument("--deepgram-language", default="ja", help="Deepgram language hint, e.g. ja or multi")
    parser.add_argument("--keyword", action="append", default=[], help="Deepgram Nova-3 keyterm hint")
    parser.add_argument("--dotenv", type=Path, default=Path(".env"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    load_dotenv(args.dotenv)
    args.work_dir.mkdir(parents=True, exist_ok=True)

    if args.audio:
        audio_path = args.audio.expanduser()
        video_id = Path(args.video).stem
    else:
        video_path, video_id = resolve_video(args.video, args.work_dir)
        audio_path = args.work_dir / f"{video_id}.wav"
        extract_audio(video_path, audio_path)

    provider_meta = PROVIDERS[args.provider]
    if args.provider.startswith("gemini"):
        segments, raw = transcribe_gemini(audio_path, provider_meta["model"])
    elif args.provider == "deepgram-nova3":
        segments, raw = transcribe_deepgram(audio_path, args.deepgram_language, args.keyword)
    else:
        raise RuntimeError(f"unsupported provider: {args.provider}")

    track = make_track(args.provider, segments)
    output = {
        "video_id": video_id,
        "audio_path": str(audio_path),
        "provider": args.provider,
        "model": provider_meta["model"],
        "track": track,
        "raw": raw,
    }

    output_path = args.output or args.work_dir / f"{video_id}.{args.provider}.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {output_path}")
    print(f"segments={len(segments)}")

    if args.fixture:
        update_fixture(args.fixture, track, args.after_track_id)
        print(f"updated fixture {args.fixture}")

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
