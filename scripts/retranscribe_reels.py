#!/usr/bin/env python3
"""
Re-transcribe reel videos using Google Cloud Speech-to-Text.
Downloads video → extracts audio → STT → saves timestamped transcript.
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

from google.cloud import speech_v1 as speech

# Config
PROJECT_ID = "kiokun"
COSMOS_CDN = "https://cdn.cosmos.so"
OUTPUT_DIR = Path(__file__).parent.parent / "sveltekit-app" / "static"
VIDEO_DATA_FILE = OUTPUT_DIR / "video_data.json"
TRANSCRIPT_OUTPUT = OUTPUT_DIR / "reel_transcripts.json"

# GCP STT config for Japanese
STT_CONFIG = speech.RecognitionConfig(
    encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
    sample_rate_hertz=16000,
    language_code="ja-JP",
    enable_word_time_offsets=True,
    enable_automatic_punctuation=True,
    model="latest_long",
)


def download_and_extract_audio(video_id: str, tmp_dir: str) -> str | None:
    """Download video from Cosmos CDN and extract audio as WAV."""
    video_url = f"{COSMOS_CDN}/{video_id}.mp4"
    video_path = os.path.join(tmp_dir, f"{video_id}.mp4")
    audio_path = os.path.join(tmp_dir, f"{video_id}.wav")

    # Download video
    result = subprocess.run(
        ["curl", "-sL", "-o", video_path, video_url],
        capture_output=True, timeout=60
    )
    if result.returncode != 0 or not os.path.exists(video_path) or os.path.getsize(video_path) < 1000:
        print(f"  ✗ Failed to download {video_id}")
        return None

    # Extract audio as 16kHz mono WAV
    result = subprocess.run(
        ["ffmpeg", "-y", "-i", video_path, "-ac", "1", "-ar", "16000", "-f", "wav", audio_path],
        capture_output=True, timeout=120
    )
    if result.returncode != 0 or not os.path.exists(audio_path):
        print(f"  ✗ Failed to extract audio for {video_id}")
        return None

    # Clean up video to save space
    os.remove(video_path)
    return audio_path


def transcribe_audio(audio_path: str) -> list[dict] | None:
    """Send audio to GCP STT and get timestamped words."""
    client = speech.SpeechClient()

    with open(audio_path, "rb") as f:
        audio_content = f.read()

    # For files > 1 minute, use long running recognize
    audio_size_seconds = os.path.getsize(audio_path) / (16000 * 2)  # 16kHz, 16-bit

    audio = speech.RecognitionAudio(content=audio_content)

    if audio_size_seconds > 60:
        operation = client.long_running_recognize(config=STT_CONFIG, audio=audio)
        response = operation.result(timeout=300)
    else:
        response = client.recognize(config=STT_CONFIG, audio=audio)

    segments = []
    for result in response.results:
        if not result.alternatives:
            continue
        alt = result.alternatives[0]

        # Build sentence with word timestamps
        words = []
        sentence_start = None
        sentence_end = None

        for word_info in alt.words:
            st = word_info.start_time
            et = word_info.end_time
            start_s = st.seconds + st.microseconds / 1e6 if hasattr(st, 'microseconds') else (st.seconds + st.nanos / 1e9 if hasattr(st, 'nanos') else float(st))
            end_s = et.seconds + et.microseconds / 1e6 if hasattr(et, 'microseconds') else (et.seconds + et.nanos / 1e9 if hasattr(et, 'nanos') else float(et))

            if sentence_start is None:
                sentence_start = start_s
            sentence_end = end_s

            words.append({
                "word": word_info.word,
                "start": round(start_s, 2),
                "end": round(end_s, 2),
            })

        if words:
            segments.append({
                "sentence": alt.transcript,
                "start_time": round(sentence_start, 2),
                "end_time": round(sentence_end, 2),
                "confidence": round(alt.confidence, 3),
                "words": words,
            })

    return segments


def process_video(video_id: str, tmp_dir: str) -> tuple[str, list[dict] | None]:
    """Process a single video: download → extract audio → transcribe."""
    audio_path = download_and_extract_audio(video_id, tmp_dir)
    if not audio_path:
        return video_id, None

    try:
        segments = transcribe_audio(audio_path)
        return video_id, segments
    except Exception as e:
        print(f"  ✗ STT error for {video_id}: {e}")
        return video_id, None
    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)


def main():
    # Load video data
    with open(VIDEO_DATA_FILE) as f:
        video_data = json.load(f)

    video_ids = list(video_data["videos"].keys())
    print(f"Total videos: {len(video_ids)}")

    # Load existing transcripts if resuming
    transcripts = {}
    if TRANSCRIPT_OUTPUT.exists():
        with open(TRANSCRIPT_OUTPUT) as f:
            transcripts = json.load(f)
        print(f"Resuming: {len(transcripts)} already transcribed")

    # Filter out already-done videos
    remaining = [vid for vid in video_ids if vid not in transcripts]
    print(f"Remaining: {len(remaining)}")

    if not remaining:
        print("All videos already transcribed!")
        return

    # Process in batches
    batch_size = 5
    with tempfile.TemporaryDirectory() as tmp_dir:
        for i in range(0, len(remaining), batch_size):
            batch = remaining[i:i + batch_size]
            print(f"\nBatch {i // batch_size + 1}: processing {len(batch)} videos ({i + 1}-{min(i + batch_size, len(remaining))} of {len(remaining)})")

            for video_id in batch:
                print(f"  Processing {video_id}...")
                vid, segments = process_video(video_id, tmp_dir)
                if segments is not None:
                    transcripts[vid] = segments
                    print(f"  ✓ {len(segments)} segments")
                else:
                    transcripts[vid] = []  # Mark as attempted
                    print(f"  ✗ No transcript")

            # Save after each batch (resume-safe)
            with open(TRANSCRIPT_OUTPUT, "w") as f:
                json.dump(transcripts, f, ensure_ascii=False)
            print(f"  Saved ({len(transcripts)}/{len(video_ids)} total)")

    print(f"\nDone! {len(transcripts)} videos transcribed.")
    print(f"Output: {TRANSCRIPT_OUTPUT}")


if __name__ == "__main__":
    main()
