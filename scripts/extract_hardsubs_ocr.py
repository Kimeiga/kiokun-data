#!/usr/bin/env python3
"""Extract burned-in subtitles from a reel using cropped-frame OCR."""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


COSMOS_CDN = "https://cdn.cosmos.so"
JAPANESE_RE = re.compile(r"[\u3040-\u30ff\u3400-\u9fff々〆〤ヶー※]")


def is_probable_video_id(value: str) -> bool:
    return bool(re.fullmatch(r"[0-9a-fA-F-]{36}", value))


def resolve_video(video_arg: str, work_dir: Path) -> tuple[Path, str]:
    """Return a local video path and a stable video id/name."""
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


def run_ffmpeg(video_path: Path, crops_dir: Path, fps: float, crop: str, max_frames: int | None) -> None:
    crops_dir.mkdir(parents=True, exist_ok=True)
    frame_pattern = crops_dir / "frame_%05d.jpg"
    vf = f"fps={fps},{crop}"
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(video_path),
        "-vf",
        vf,
    ]
    if max_frames:
        cmd += ["-frames:v", str(max_frames)]
    cmd.append(str(frame_pattern))
    subprocess.run(cmd, check=True)


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", "", text).strip()


def is_usable_text(text: str) -> bool:
    return bool(text and JAPANESE_RE.search(text))


def extract_paddle_text(result: dict, min_score: float) -> tuple[str, float]:
    lines: list[tuple[int, str, float]] = []
    texts = result.get("rec_texts") or []
    scores = result.get("rec_scores") or []
    boxes = result.get("rec_boxes")

    for idx, text in enumerate(texts):
        score = float(scores[idx]) if idx < len(scores) else 0.0
        text = str(text).strip()
        if score < min_score or not is_usable_text(text):
            continue
        y = idx
        if boxes is not None and idx < len(boxes):
            y = int(boxes[idx][1])
        lines.append((y, text, score))

    lines.sort(key=lambda item: item[0])
    if not lines:
        return "", 0.0

    text = "\n".join(line for _, line, _ in lines)
    avg_score = sum(score for _, _, score in lines) / len(lines)
    return text, avg_score


def similar(left: str, right: str, threshold: float) -> bool:
    if not left or not right:
        return left == right
    return SequenceMatcher(None, normalize_text(left), normalize_text(right)).ratio() >= threshold


def best_segment_text(frames: list[dict]) -> tuple[str, float]:
    buckets: dict[str, dict] = defaultdict(lambda: {"text": "", "count": 0, "score": 0.0})
    for frame in frames:
        key = normalize_text(frame["text"])
        buckets[key]["text"] = frame["text"]
        buckets[key]["count"] += 1
        buckets[key]["score"] += frame["score"]
    best = max(buckets.values(), key=lambda item: (item["count"], item["score"]))
    avg_score = best["score"] / max(best["count"], 1)
    return best["text"], avg_score


def group_frames(frames: list[dict], fps: float, threshold: float) -> list[dict]:
    segments: list[dict] = []
    current: list[dict] = []

    def flush() -> None:
        if not current:
            return
        text, avg_score = best_segment_text(current)
        segments.append(
            {
                "start": round(current[0]["timestamp"], 3),
                "end": round(current[-1]["timestamp"] + 1 / fps, 3),
                "text": text,
                "confidence": round(avg_score, 4),
                "frame_count": len(current),
                "sample_frame": current[len(current) // 2]["path"],
            }
        )

    for frame in frames:
        if not frame["text"]:
            flush()
            current = []
            continue
        if not current or similar(current[-1]["text"], frame["text"], threshold):
            current.append(frame)
        else:
            flush()
            current = [frame]
    flush()
    return segments


def run_paddle(crops_dir: Path, fps: float, min_score: float, fuzzy_threshold: float) -> tuple[list[dict], list[dict]]:
    from paddleocr import PaddleOCR

    ocr = PaddleOCR(
        lang="japan",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )

    frames: list[dict] = []
    crop_paths = sorted(crops_dir.glob("frame_*.jpg"))
    for idx, crop_path in enumerate(crop_paths, start=1):
        result = ocr.predict(str(crop_path))[0]
        text, score = extract_paddle_text(result, min_score=min_score)
        frames.append(
            {
                "frame": idx,
                "timestamp": round((idx - 1) / fps, 3),
                "path": str(crop_path),
                "text": text,
                "score": round(score, 4),
            }
        )

    return frames, group_frames(frames, fps=fps, threshold=fuzzy_threshold)


VISION_SCOPE = "https://www.googleapis.com/auth/cloud-platform"


def get_google_vision_access_token(credentials_env: str) -> tuple[str | None, str | None]:
    credentials_path = os.environ.get(credentials_env) or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not credentials_path:
        return None, None

    try:
        from google.auth.transport.requests import Request as GoogleAuthRequest
        from google.oauth2 import service_account
    except ImportError as exc:
        raise RuntimeError("service-account auth requires google-auth: pip install google-auth requests") from exc

    credentials = service_account.Credentials.from_service_account_file(
        credentials_path,
        scopes=[VISION_SCOPE],
    )
    credentials.refresh(GoogleAuthRequest())
    return credentials.token, credentials_path


def google_vision_text_detection(
    image_path: Path,
    *,
    api_key: str | None = None,
    access_token: str | None = None,
) -> dict:
    endpoint = "https://vision.googleapis.com/v1/images:annotate"
    if api_key:
        endpoint = f"{endpoint}?key={api_key}"

    image_content = base64.b64encode(image_path.read_bytes()).decode("ascii")
    payload = json.dumps(
        {
            "requests": [
                {
                    "image": {"content": image_content},
                    "features": [{"type": "TEXT_DETECTION"}],
                    "imageContext": {"languageHints": ["ja"]},
                }
            ]
        }
    ).encode("utf-8")
    req = Request(
        endpoint,
        data=payload,
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {access_token}"} if access_token else {}),
        },
        method="POST",
    )
    with urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def run_google_vision_probe(
    segments: list[dict],
    sample_count: int,
    api_key_env: str,
    credentials_env: str,
    auth_mode: str,
) -> dict:
    api_key = None
    access_token = None
    credentials_path = None
    auth_type = None

    if auth_mode in ("auto", "service-account"):
        try:
            access_token, credentials_path = get_google_vision_access_token(credentials_env)
        except Exception as exc:
            if auth_mode == "service-account":
                return {"error": str(exc)}
            access_token = None
        if access_token:
            auth_type = "service-account"

    if not access_token and auth_mode in ("auto", "api-key"):
        api_key = os.environ.get(api_key_env) or os.environ.get("GEMINI_API_KEY")
        if api_key:
            auth_type = "api-key"

    if not auth_type:
        return {
            "error": (
                f"missing credentials: set {credentials_env} or GOOGLE_APPLICATION_CREDENTIALS "
                f"to a service-account JSON path, or set {api_key_env}"
            )
        }

    samples = []
    seen = set()
    for segment in segments:
        text_key = normalize_text(segment["text"])
        if text_key in seen:
            continue
        seen.add(text_key)
        samples.append(segment)
        if len(samples) >= sample_count:
            break

    results = []
    for segment in samples:
        path = Path(segment["sample_frame"])
        started = time.perf_counter()
        try:
            response = google_vision_text_detection(path, api_key=api_key, access_token=access_token)
            annotation = (response.get("responses") or [{}])[0]
            detected = ""
            if annotation.get("textAnnotations"):
                detected = annotation["textAnnotations"][0].get("description", "").strip()
            error = annotation.get("error")
            results.append(
                {
                    "start": segment["start"],
                    "end": segment["end"],
                    "paddle_text": segment["text"],
                    "google_text": detected,
                    "error": error,
                    "elapsed_seconds": round(time.perf_counter() - started, 3),
                    "sample_frame": str(path),
                }
            )
        except HTTPError as exc:
            body = exc.read().decode("utf-8", "replace")
            results.append(
                {
                    "start": segment["start"],
                    "end": segment["end"],
                    "paddle_text": segment["text"],
                    "error": {"code": exc.code, "body": body},
                    "elapsed_seconds": round(time.perf_counter() - started, 3),
                    "sample_frame": str(path),
                }
            )
        except Exception as exc:
            results.append(
                {
                    "start": segment["start"],
                    "end": segment["end"],
                    "paddle_text": segment["text"],
                    "error": str(exc),
                    "elapsed_seconds": round(time.perf_counter() - started, 3),
                    "sample_frame": str(path),
                }
            )
    output = {"auth_type": auth_type, "sample_count": len(results), "results": results}
    if credentials_path:
        output["credentials_file"] = str(Path(credentials_path).expanduser())
    return output


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", help="Local video path, Cosmos video id, or video URL")
    parser.add_argument("--output", "-o", type=Path, help="JSON output path")
    parser.add_argument("--work-dir", type=Path, help="Directory for downloaded video and cropped frames")
    parser.add_argument("--fps", type=float, default=4.0, help="Frame extraction rate")
    parser.add_argument(
        "--crop",
        default="crop=iw:ih*0.50:0:ih*0.28",
        help="ffmpeg crop expression for the subtitle band",
    )
    parser.add_argument("--min-score", type=float, default=0.65, help="Minimum PaddleOCR line confidence")
    parser.add_argument("--fuzzy-threshold", type=float, default=0.86, help="Similarity threshold for grouping")
    parser.add_argument("--max-frames", type=int, help="Only process the first N cropped frames")
    parser.add_argument("--keep-work-dir", action="store_true", help="Do not delete the temp work directory")
    parser.add_argument("--google-vision-samples", type=int, default=0, help="Probe Google Vision on N grouped samples")
    parser.add_argument("--google-auth", choices=["auto", "service-account", "api-key"], default="auto")
    parser.add_argument("--google-api-key-env", default="GOOGLE_CLOUD_VISION_API_KEY")
    parser.add_argument("--google-credentials-env", default="GOOGLE_APPLICATION_CREDENTIALS")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    created_temp_dir = False
    if args.work_dir:
        work_dir = args.work_dir
        work_dir.mkdir(parents=True, exist_ok=True)
    else:
        work_dir = Path(tempfile.mkdtemp(prefix="kiokun-hardsubs-"))
        created_temp_dir = True

    try:
        video_path, video_id = resolve_video(args.video, work_dir)
        crops_dir = work_dir / "crops"
        run_ffmpeg(video_path, crops_dir, fps=args.fps, crop=args.crop, max_frames=args.max_frames)
        frames, segments = run_paddle(
            crops_dir,
            fps=args.fps,
            min_score=args.min_score,
            fuzzy_threshold=args.fuzzy_threshold,
        )
        output = {
            "video_id": video_id,
            "video_path": str(video_path),
            "fps": args.fps,
            "crop": args.crop,
            "frame_count": len(frames),
            "segments": segments,
            "frames": frames,
        }
        if args.google_vision_samples:
            output["google_vision_probe"] = run_google_vision_probe(
                segments,
                sample_count=args.google_vision_samples,
                api_key_env=args.google_api_key_env,
                credentials_env=args.google_credentials_env,
                auth_mode=args.google_auth,
            )

        output_path = args.output or Path("output") / "hardsubs" / f"{video_id}.json"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as out:
            json.dump(output, out, ensure_ascii=False, indent=2)
        print(f"wrote {output_path}")
        print(f"frames={len(frames)} segments={len(segments)}")
        return 0
    finally:
        if created_temp_dir and not args.keep_work_dir:
            shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
