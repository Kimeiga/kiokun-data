#!/usr/bin/env python3
"""Run audio-only ASR experiments for a reel and output comparison tracks."""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.parse
import uuid
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
    "openai-gpt-4o-transcribe": {
        "track_id": "openai-gpt-4o-transcribe",
        "label": "OpenAI gpt-4o-transcribe",
        "source": "OpenAI Audio Transcriptions API; Japanese language hint",
        "kind": "audio-stt",
        "model": "gpt-4o-transcribe",
    },
    "openai-gpt-4o-mini-transcribe": {
        "track_id": "openai-gpt-4o-mini-transcribe",
        "label": "OpenAI gpt-4o-mini-transcribe",
        "source": "OpenAI Audio Transcriptions API; Japanese language hint",
        "kind": "audio-stt",
        "model": "gpt-4o-mini-transcribe",
    },
    "openai-gpt-4o-transcribe-diarize": {
        "track_id": "openai-gpt-4o-transcribe-diarize",
        "label": "OpenAI gpt-4o-transcribe-diarize",
        "source": "OpenAI Audio Transcriptions API; diarized JSON",
        "kind": "audio-stt",
        "model": "gpt-4o-transcribe-diarize",
    },
    "openai-whisper-1": {
        "track_id": "openai-whisper-1",
        "label": "OpenAI whisper-1",
        "source": "OpenAI Audio Transcriptions API; verbose_json segments",
        "kind": "audio-stt",
        "model": "whisper-1",
    },
    "google-chirp3": {
        "track_id": "google-chirp3",
        "label": "Google Speech-to-Text Chirp 3",
        "source": "Google Cloud Speech-to-Text V2 recognize; chirp_3 model",
        "kind": "audio-stt",
        "model": "chirp_3",
    },
    "elevenlabs-scribe-v2": {
        "track_id": "elevenlabs-scribe-v2",
        "label": "ElevenLabs Scribe v2",
        "source": "ElevenLabs Speech-to-Text API; scribe_v2 with word timestamps",
        "kind": "audio-stt",
        "model": "scribe_v2",
    },
    "soniox-stt-async-v4": {
        "track_id": "soniox-stt-async-v4",
        "label": "Soniox STT Async v4",
        "source": "Soniox async transcription API; Japanese language hint",
        "kind": "audio-stt",
        "model": "stt-async-v4",
    },
    "mlx-whisper-large-v3-turbo": {
        "track_id": "mlx-whisper-large-v3-turbo",
        "label": "MLX Whisper large-v3-turbo",
        "source": "Local MLX Whisper on Apple Silicon",
        "kind": "audio-stt",
        "model": "mlx-community/whisper-large-v3-turbo",
    },
    "hf-kotoba-whisper-v2": {
        "track_id": "hf-kotoba-whisper-v2",
        "label": "Kotoba-Whisper v2.0",
        "source": "Local Hugging Face Transformers ASR pipeline",
        "kind": "audio-stt",
        "model": "kotoba-tech/kotoba-whisper-v2.0",
    },
    "qwen3-asr-1.7b": {
        "track_id": "qwen3-asr-1.7b",
        "label": "Qwen3-ASR-1.7B",
        "source": "Local Qwen3-ASR with Qwen forced aligner timestamps",
        "kind": "audio-stt",
        "model": "Qwen/Qwen3-ASR-1.7B",
    },
    "reazonspeech-k2-v2": {
        "track_id": "reazonspeech-k2-v2",
        "label": "ReazonSpeech k2 v2",
        "source": "Local ReazonSpeech K2 ASR",
        "kind": "audio-stt",
        "model": "reazonspeech-k2-v2",
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


def get_audio_duration(audio_path: Path) -> float:
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
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 0.0


def parse_duration(value: str | int | float | None) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if text.endswith("s"):
        text = text[:-1]
    try:
        return float(text)
    except ValueError:
        return 0.0


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


def normalize_word_tokens(words: list[dict], fallback_duration: float = 0.0, gap_threshold: float = 0.7) -> list[dict]:
    segments: list[dict] = []
    current_words: list[str] = []
    start: float | None = None
    end = 0.0
    confidences: list[float] = []

    for word in words:
        text = str(word.get("text") or word.get("word") or "").strip()
        if not text:
            continue
        word_start = parse_duration(word.get("start", word.get("start_time", word.get("start_ms", 0))))
        word_end = parse_duration(word.get("end", word.get("end_time", word.get("end_ms", word_start))))
        if "start_ms" in word:
            word_start /= 1000
        if "end_ms" in word:
            word_end /= 1000
        if start is not None and word_start - end > gap_threshold and current_words:
            segment = {
                "start_time": round(start, 3),
                "end_time": round(end, 3),
                "text": "".join(current_words).strip(),
            }
            if confidences:
                segment["confidence"] = round(sum(confidences) / len(confidences), 3)
            segments.append(segment)
            current_words = []
            confidences = []
            start = None
        if start is None:
            start = word_start
        current_words.append(text)
        end = max(end, word_end)
        if word.get("confidence") is not None:
            confidences.append(float(word["confidence"]))
        elif word.get("logprob") is not None:
            confidences.append(float(word["logprob"]))

    if current_words:
        segment = {
            "start_time": round(start or 0, 3),
            "end_time": round(end or fallback_duration, 3),
            "text": "".join(current_words).strip(),
        }
        if confidences:
            segment["confidence"] = round(sum(confidences) / len(confidences), 3)
        segments.append(segment)
    return segments


def read_json_response(response) -> dict:
    return json.loads(response.read().decode("utf-8"))


def read_http_error(exc: HTTPError) -> str:
    try:
        return exc.read().decode("utf-8")
    except Exception:
        return str(exc)


def request_json(req: Request, timeout: int = 180) -> dict:
    try:
        with urlopen(req, timeout=timeout) as response:
            return read_json_response(response)
    except HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code}: {read_http_error(exc)}") from exc


def post_json(url: str, payload: dict, headers: dict[str, str] | None = None, timeout: int = 180) -> dict:
    req = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    return request_json(req, timeout=timeout)


def get_json(url: str, headers: dict[str, str] | None = None, timeout: int = 180) -> dict:
    req = Request(url, headers=headers or {}, method="GET")
    return request_json(req, timeout=timeout)


def multipart_body(fields: list[tuple[str, str]], file_field: tuple[str, Path, str | None] | None = None) -> tuple[bytes, str]:
    boundary = f"----kiokun-{uuid.uuid4().hex}"
    chunks: list[bytes] = []

    for name, value in fields:
        chunks.extend([
            f"--{boundary}\r\n".encode("utf-8"),
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"),
            str(value).encode("utf-8"),
            b"\r\n",
        ])

    if file_field:
        name, path, content_type = file_field
        content_type = content_type or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        chunks.extend([
            f"--{boundary}\r\n".encode("utf-8"),
            (
                f'Content-Disposition: form-data; name="{name}"; '
                f'filename="{path.name}"\r\n'
            ).encode("utf-8"),
            f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"),
            path.read_bytes(),
            b"\r\n",
        ])

    chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def post_multipart(
    url: str,
    fields: list[tuple[str, str]],
    file_field: tuple[str, Path, str | None],
    headers: dict[str, str] | None = None,
    timeout: int = 180,
) -> dict:
    body, content_type = multipart_body(fields, file_field)
    req = Request(
        url,
        data=body,
        headers={"Content-Type": content_type, **(headers or {})},
        method="POST",
    )
    return request_json(req, timeout=timeout)


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
    raw = request_json(req)
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
    raw = request_json(req)

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


def transcribe_openai(audio_path: Path, model: str, duration: float, keyterms: list[str]) -> tuple[list[dict], dict]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("missing OPENAI_API_KEY")

    prompt_terms = ", ".join(keyterms) if keyterms else "宮下パーク, ユニコーン, 橋の上, 叫んで"
    fields = [
        ("model", model),
        ("language", "ja"),
    ]
    if model == "gpt-4o-transcribe-diarize":
        fields.extend([
            ("response_format", "diarized_json"),
            ("chunking_strategy", "auto"),
        ])
    elif model == "whisper-1":
        fields.append(("prompt", f"Japanese Instagram/Reels dialogue. Preserve casual speech and these terms when audible: {prompt_terms}."))
        fields.extend([
            ("response_format", "verbose_json"),
            ("timestamp_granularities[]", "word"),
        ])
    else:
        fields.append(("prompt", f"Japanese Instagram/Reels dialogue. Preserve casual speech and these terms when audible: {prompt_terms}."))
        fields.append(("response_format", "json"))

    raw = post_multipart(
        "https://api.openai.com/v1/audio/transcriptions",
        fields,
        ("file", audio_path, "audio/wav"),
        headers={"Authorization": f"Bearer {api_key}"},
    )

    if raw.get("segments"):
        return normalize_segments(raw["segments"]), raw
    if raw.get("words"):
        return normalize_word_tokens(raw["words"], fallback_duration=duration), raw
    if raw.get("text"):
        return [{"start_time": 0, "end_time": round(duration, 3), "text": raw["text"].strip()}], raw
    return [], raw


def get_google_access_token() -> tuple[str, str | None]:
    try:
        import google.auth
        from google.auth.transport.requests import Request as GoogleAuthRequest
        from google.oauth2 import service_account
    except ImportError as exc:
        raise RuntimeError(
            "missing google-auth; run with .venv/bin/python or install google-auth"
        ) from exc

    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    credentials_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if credentials_path:
        credentials = service_account.Credentials.from_service_account_file(credentials_path, scopes=scopes)
        project_id = getattr(credentials, "project_id", None)
    else:
        credentials, project_id = google.auth.default(scopes=scopes)
    credentials.refresh(GoogleAuthRequest())
    return credentials.token, project_id


def transcribe_google_chirp3(audio_path: Path, project_id: str | None, location: str) -> tuple[list[dict], dict]:
    token, credential_project = get_google_access_token()
    project = project_id or os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCLOUD_PROJECT") or credential_project
    if not project:
        raise RuntimeError("missing Google project id; set GOOGLE_CLOUD_PROJECT=kiokun or use a service-account JSON with project_id")

    host = "speech.googleapis.com" if location == "global" else f"{location}-speech.googleapis.com"
    endpoint = (
        f"https://{host}/v2/projects/{urllib.parse.quote(project)}/"
        f"locations/{urllib.parse.quote(location)}/recognizers/_:recognize"
    )
    payload = {
        "config": {
            "autoDecodingConfig": {},
            "languageCodes": ["ja-JP"],
            "model": "chirp_3",
        },
        "content": base64.b64encode(audio_path.read_bytes()).decode("ascii"),
    }
    raw = post_json(endpoint, payload, headers={"Authorization": f"Bearer {token}"})

    segments: list[dict] = []
    previous_end = 0.0
    for result in raw.get("results", []):
        alternatives = result.get("alternatives") or []
        if not alternatives:
            continue
        alternative = alternatives[0]
        text = (alternative.get("transcript") or "").strip()
        if not text:
            continue
        end = parse_duration(result.get("resultEndOffset")) or previous_end
        segment = {
            "start_time": round(previous_end, 3),
            "end_time": round(max(end, previous_end), 3),
            "text": text,
        }
        if alternative.get("confidence") is not None:
            segment["confidence"] = alternative["confidence"]
        if result.get("languageCode"):
            segment["language_code"] = result["languageCode"]
        segments.append(segment)
        previous_end = max(end, previous_end)
    return segments, raw


def transcribe_elevenlabs(audio_path: Path, model: str, duration: float, keyterms: list[str]) -> tuple[list[dict], dict]:
    api_key = os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("XI_API_KEY")
    if not api_key:
        raise RuntimeError("missing ELEVENLABS_API_KEY")

    fields = [
        ("model_id", model),
        ("language_code", "ja"),
        ("timestamps_granularity", "word"),
        ("diarize", "true"),
        ("tag_audio_events", "false"),
        ("file_format", "pcm_s16le_16"),
    ]
    for keyterm in keyterms:
        fields.append(("keyterms", keyterm))

    raw = post_multipart(
        "https://api.elevenlabs.io/v1/speech-to-text",
        fields,
        ("file", audio_path, "audio/wav"),
        headers={"xi-api-key": api_key},
    )

    words = [word for word in raw.get("words", []) if word.get("type") != "spacing"]
    if words:
        return normalize_word_tokens(words, fallback_duration=duration), raw
    if raw.get("text"):
        return [{"start_time": 0, "end_time": round(duration, 3), "text": raw["text"].strip()}], raw
    return [], raw


def transcribe_soniox(audio_path: Path, model: str, duration: float, keyterms: list[str]) -> tuple[list[dict], dict]:
    api_key = os.environ.get("SONIOX_API_KEY")
    if not api_key:
        raise RuntimeError("missing SONIOX_API_KEY")

    headers = {"Authorization": f"Bearer {api_key}"}
    upload = post_multipart(
        "https://api.soniox.com/v1/files",
        [],
        ("file", audio_path, "audio/wav"),
        headers=headers,
    )
    file_id = upload["id"]
    context_terms = keyterms or ["宮下パーク", "ユニコーン", "橋の上", "叫んで"]
    create = post_json(
        "https://api.soniox.com/v1/transcriptions",
        {
            "model": model,
            "file_id": file_id,
            "language_hints": ["ja"],
            "language_hints_strict": True,
            "context": "Japanese Instagram/Reels dialogue. Important terms: " + ", ".join(context_terms),
        },
        headers=headers,
    )

    transcription_id = create["id"]
    status = create
    for _ in range(60):
        if status.get("status") in ("completed", "error"):
            break
        time.sleep(2)
        status = get_json(f"https://api.soniox.com/v1/transcriptions/{transcription_id}", headers=headers)

    if status.get("status") != "completed":
        detail = status.get("error_message") or status.get("error_type") or status.get("status")
        raise RuntimeError(f"Soniox transcription did not complete: {detail}")

    transcript = get_json(
        f"https://api.soniox.com/v1/transcriptions/{transcription_id}/transcript",
        headers=headers,
    )
    segments = normalize_word_tokens(transcript.get("tokens", []), fallback_duration=duration)
    if not segments and transcript.get("text"):
        segments = [{"start_time": 0, "end_time": round(duration, 3), "text": transcript["text"].strip()}]
    return segments, {"upload": upload, "create": create, "status": status, "transcript": transcript}


def transcribe_mlx_whisper(audio_path: Path, model: str, keyterms: list[str]) -> tuple[list[dict], dict]:
    try:
        import mlx_whisper
    except ImportError as exc:
        raise RuntimeError(
            "missing mlx-whisper; run with `uv run --with mlx-whisper --python 3.11 python scripts/transcribe_reel_audio.py ...`"
        ) from exc

    prompt_terms = "、".join(keyterms or ["宮下パーク", "ユニコーン", "橋の上", "叫んで"])
    raw = mlx_whisper.transcribe(
        str(audio_path),
        path_or_hf_repo=model,
        language="ja",
        task="transcribe",
        temperature=0.0,
        initial_prompt=f"日本語の会話。固有名詞や語句: {prompt_terms}",
        word_timestamps=True,
        verbose=False,
    )
    if raw.get("segments"):
        return normalize_segments(raw["segments"]), raw
    if raw.get("words"):
        return normalize_word_tokens(raw["words"]), raw
    if raw.get("text"):
        return [{"start_time": 0, "end_time": 0, "text": raw["text"].strip()}], raw
    return [], raw


def transcribe_transformers_whisper(audio_path: Path, model: str, duration: float) -> tuple[list[dict], dict]:
    try:
        import torch
        from transformers import pipeline
    except ImportError as exc:
        raise RuntimeError(
            "missing transformers/torch; run with `uv run --with transformers --with torch --with accelerate --with librosa --with soundfile --python 3.11 python scripts/transcribe_reel_audio.py ...`"
        ) from exc

    if torch.backends.mps.is_available():
        device = "mps"
        torch_dtype = torch.float16
    else:
        device = "cpu"
        torch_dtype = torch.float32

    pipe = pipeline(
        "automatic-speech-recognition",
        model=model,
        torch_dtype=torch_dtype,
        device=device,
        batch_size=8,
    )
    raw = pipe(
        str(audio_path),
        return_timestamps=True,
        generate_kwargs={"language": "ja", "task": "transcribe"},
    )
    chunks = raw.get("chunks") or []
    segments = []
    for chunk in chunks:
        timestamp = chunk.get("timestamp") or (0, 0)
        start, end = timestamp if len(timestamp) == 2 else (0, 0)
        segments.append({
            "start_time": start or 0,
            "end_time": end or start or duration,
            "text": chunk.get("text", "").strip(),
        })
    segments = normalize_segments(segments)
    if not segments and raw.get("text"):
        segments = [{"start_time": 0, "end_time": round(duration, 3), "text": raw["text"].strip()}]
    return segments, raw


def qwen_items_to_segments(
    items: list[dict],
    fallback_duration: float,
    gap_threshold: float = 0.55,
    max_segment_duration: float = 3.2,
    max_chars: int = 34,
) -> list[dict]:
    segments: list[dict] = []
    current: list[str] = []
    start: float | None = None
    end = 0.0

    def flush() -> None:
        nonlocal current, start, end
        text = "".join(current).strip()
        if text:
            segments.append({
                "start_time": round(start or 0, 3),
                "end_time": round(end or start or fallback_duration, 3),
                "text": text,
            })
        current = []
        start = None
        end = 0.0

    for item in items:
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        item_start = float(item.get("start_time", 0) or 0)
        item_end = float(item.get("end_time", item_start) or item_start)
        should_split = (
            start is not None
            and current
            and (
                item_start - end > gap_threshold
                or item_end - start > max_segment_duration
                or len("".join(current)) + len(text) > max_chars
            )
        )
        if should_split:
            flush()
        if start is None:
            start = item_start
        current.append(text)
        end = max(end, item_end, item_start)

    if current:
        flush()
    return segments


def transcribe_qwen3_asr(audio_path: Path, model_name: str, duration: float, keyterms: list[str]) -> tuple[list[dict], dict]:
    try:
        import torch
        from qwen_asr import Qwen3ASRModel
    except ImportError as exc:
        raise RuntimeError(
            "missing qwen-asr; run with `uv run --with qwen-asr --python 3.12 python scripts/transcribe_reel_audio.py ...`"
        ) from exc

    if torch.cuda.is_available():
        device = "cuda:0"
        torch_dtype = torch.bfloat16
    elif torch.backends.mps.is_available():
        device = "mps"
        torch_dtype = torch.float16
    else:
        device = "cpu"
        torch_dtype = torch.float32

    context_terms = "、".join(keyterms or ["宮下パーク", "ユニコーン", "橋の上", "叫んで"])
    model = Qwen3ASRModel.from_pretrained(
        model_name,
        dtype=torch_dtype,
        device_map=device,
        max_inference_batch_size=1,
        max_new_tokens=512,
        forced_aligner="Qwen/Qwen3-ForcedAligner-0.6B",
        forced_aligner_kwargs={"dtype": torch_dtype, "device_map": device},
    )
    results = model.transcribe(
        audio=str(audio_path),
        language="Japanese",
        context=f"Japanese Instagram/Reels dialogue. Important terms: {context_terms}",
        return_time_stamps=True,
    )
    raw_results: list[dict] = []
    segments: list[dict] = []
    for result in results:
        stamps = getattr(result, "time_stamps", None)
        items = []
        for item in getattr(stamps, "items", []) or []:
            item_data = {
                "text": str(getattr(item, "text", "")),
                "start_time": float(getattr(item, "start_time", 0.0) or 0.0),
                "end_time": float(getattr(item, "end_time", 0.0) or 0.0),
            }
            items.append(item_data)
        result_data = {
            "language": getattr(result, "language", None),
            "text": getattr(result, "text", ""),
            "time_stamps": {"items": items},
        }
        raw_results.append(result_data)
        if items:
            segments.extend(qwen_items_to_segments(items, duration))
        elif result_data["text"]:
            segments.append({
                "start_time": 0,
                "end_time": round(duration, 3),
                "text": str(result_data["text"]).strip(),
            })

    return normalize_segments(segments), {"device": device, "results": raw_results}


def transcribe_reazonspeech_k2(audio_path: Path, duration: float) -> tuple[list[dict], dict]:
    try:
        from reazonspeech.k2.asr import audio_from_path, load_model, transcribe
    except ImportError as exc:
        raise RuntimeError(
            "missing ReazonSpeech K2; run with `uv run --with 'git+https://github.com/reazon-research/ReazonSpeech#subdirectory=pkg/k2-asr' --python 3.11 python scripts/transcribe_reel_audio.py ...`"
        ) from exc

    model = load_model(device="cpu", precision="fp32", language="ja")
    raw_subwords = []
    texts = []
    with tempfile.TemporaryDirectory(prefix="kiokun-reazon-") as tmp:
        chunk_paths: list[tuple[Path, float]] = []
        if duration > 28:
            chunk_length = 20.0
            start = 0.0
            while start < duration:
                chunk_path = Path(tmp) / f"chunk-{int(start * 1000):08d}.wav"
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
                        str(chunk_length),
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
                chunk_paths.append((chunk_path, start))
                start += chunk_length
        else:
            chunk_paths.append((audio_path, 0.0))

        for chunk_path, offset in chunk_paths:
            audio = audio_from_path(str(chunk_path))
            result = transcribe(model, audio)
            if getattr(result, "text", ""):
                texts.append(result.text.strip())
            raw_subwords.extend(
                {
                    "seconds": offset + float(getattr(subword, "seconds", 0.0)),
                    "token": str(getattr(subword, "token", "")),
                }
                for subword in getattr(result, "subwords", [])
            )
    segments: list[dict] = []
    current_tokens: list[str] = []
    start: float | None = None
    last_time = 0.0
    for subword in raw_subwords:
        token = subword["token"].replace("▁", "").strip()
        if not token:
            continue
        seconds = subword["seconds"]
        if start is not None and seconds - last_time > 0.9 and current_tokens:
            segments.append({
                "start_time": round(start, 3),
                "end_time": round(last_time, 3),
                "text": "".join(current_tokens).strip(),
            })
            current_tokens = []
            start = None
        if start is None:
            start = seconds
        current_tokens.append(token)
        last_time = seconds
        if token in {"。", "？", "?", "！", "!"} and current_tokens:
            segments.append({
                "start_time": round(start, 3),
                "end_time": round(last_time, 3),
                "text": "".join(current_tokens).strip(),
            })
            current_tokens = []
            start = None
    if current_tokens:
        segments.append({
            "start_time": round(start or 0, 3),
            "end_time": round(duration, 3),
            "text": "".join(current_tokens).strip(),
        })
    if not segments and texts:
        segments = [{"start_time": 0, "end_time": round(duration, 3), "text": "".join(texts).strip()}]
    return segments, {"text": "".join(texts).strip(), "subwords": raw_subwords}


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
    parser.add_argument("--google-project", help="Google Cloud project id for Speech-to-Text V2")
    parser.add_argument("--google-location", default="us", help="Google Speech location, e.g. us, eu, or global")
    parser.add_argument("--keyword", action="append", default=[], help="Provider keyterm/context hint")
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
    duration = get_audio_duration(audio_path)

    provider_meta = PROVIDERS[args.provider]
    if args.provider.startswith("gemini"):
        segments, raw = transcribe_gemini(audio_path, provider_meta["model"])
    elif args.provider == "deepgram-nova3":
        segments, raw = transcribe_deepgram(audio_path, args.deepgram_language, args.keyword)
    elif args.provider.startswith("openai-"):
        segments, raw = transcribe_openai(audio_path, provider_meta["model"], duration, args.keyword)
    elif args.provider == "google-chirp3":
        segments, raw = transcribe_google_chirp3(audio_path, args.google_project, args.google_location)
    elif args.provider == "elevenlabs-scribe-v2":
        segments, raw = transcribe_elevenlabs(audio_path, provider_meta["model"], duration, args.keyword)
    elif args.provider == "soniox-stt-async-v4":
        segments, raw = transcribe_soniox(audio_path, provider_meta["model"], duration, args.keyword)
    elif args.provider == "mlx-whisper-large-v3-turbo":
        segments, raw = transcribe_mlx_whisper(audio_path, provider_meta["model"], args.keyword)
    elif args.provider == "hf-kotoba-whisper-v2":
        segments, raw = transcribe_transformers_whisper(audio_path, provider_meta["model"], duration)
    elif args.provider == "qwen3-asr-1.7b":
        segments, raw = transcribe_qwen3_asr(audio_path, provider_meta["model"], duration, args.keyword)
    elif args.provider == "reazonspeech-k2-v2":
        segments, raw = transcribe_reazonspeech_k2(audio_path, duration)
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

    if args.fixture and segments:
        update_fixture(args.fixture, track, args.after_track_id)
        print(f"updated fixture {args.fixture}")
    elif args.fixture:
        print(f"skipped fixture update for {args.provider}: no segments")

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
