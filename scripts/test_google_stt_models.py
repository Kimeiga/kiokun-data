#!/usr/bin/env python3
"""Test multiple Google Cloud Speech-to-Text models on the problematic video.

Expected: 神輿担ぎポーズ (mikoshi katsugi pose)
Whisper: みこしかつりポーズ (mikoshi katsuri pose)
"""

import os
import subprocess
from pathlib import Path
from google.cloud import speech_v1p1beta1 as speech  # V1 API for default model
from google.cloud.speech_v2 import SpeechClient
from google.cloud.speech_v2.types import cloud_speech
from google.api_core.client_options import ClientOptions

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.expanduser("~/kiokun-stt-key.json")
PROJECT_ID = "kiokun"
REGION = "us"  # Use US multi-region for Chirp 3

def extract_audio_segment(video_path: str, output_path: str, start_time: float = 25.0, duration: float = 10.0):
    """Extract a segment of audio from video."""
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-ss", str(start_time), "-t", str(duration),
        "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
        output_path
    ]
    subprocess.run(cmd, capture_output=True)
    print(f"Extracted audio segment: {output_path}")

def transcribe_v1_default(audio_path: str):
    """Transcribe using V1 API (default model)."""
    client = speech.SpeechClient()
    with open(audio_path, "rb") as f:
        content = f.read()

    audio = speech.RecognitionAudio(content=content)
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        language_code="ja-JP",
        enable_automatic_punctuation=True,
    )
    response = client.recognize(config=config, audio=audio)
    return " ".join([r.alternatives[0].transcript for r in response.results]) if response.results else ""

def transcribe_v2(audio_path: str, model: str):
    """Transcribe using V2 API with specified model and regional endpoint."""
    # Use regional endpoint for V2 API
    client = SpeechClient(
        client_options=ClientOptions(
            api_endpoint=f"{REGION}-speech.googleapis.com",
        )
    )
    with open(audio_path, "rb") as f:
        content = f.read()

    config = cloud_speech.RecognitionConfig(
        auto_decoding_config=cloud_speech.AutoDetectDecodingConfig(),
        language_codes=["ja-JP"],
        model=model,
    )

    request = cloud_speech.RecognizeRequest(
        recognizer=f"projects/{PROJECT_ID}/locations/{REGION}/recognizers/_",
        config=config,
        content=content,
    )

    response = client.recognize(request=request)
    return " ".join([r.alternatives[0].transcript for r in response.results]) if response.results else ""

def main():
    video_id = "f6e0c097-30a0-42cc-a380-2c3fba7d045a"
    video_path = f"cosmos_videos/{video_id}.mp4"

    if not Path(video_path).exists():
        print(f"Video not found: {video_path}")
        return

    audio_segment = "/tmp/test_segment.wav"
    extract_audio_segment(video_path, audio_segment)

    print("\n" + "="*70)
    print("GOOGLE CLOUD SPEECH-TO-TEXT - MODEL COMPARISON")
    print("="*70)
    print("\nExpected: 神輿担ぎポーズ (mikoshi katsugi pose)")
    print("Whisper:  みこしかつりポーズ (mikoshi katsuri pose)")
    print("\n" + "-"*70)

    models = [
        ("V1 Default", lambda: transcribe_v1_default(audio_segment)),
        ("chirp_3", lambda: transcribe_v2(audio_segment, "chirp_3")),  # Newest, best accuracy
        ("chirp_2", lambda: transcribe_v2(audio_segment, "chirp_2")),
        ("chirp", lambda: transcribe_v2(audio_segment, "chirp")),
        ("long", lambda: transcribe_v2(audio_segment, "long")),
        ("short", lambda: transcribe_v2(audio_segment, "short")),
    ]

    results = []
    for model_name, transcribe_fn in models:
        print(f"\n{model_name}:")
        try:
            transcript = transcribe_fn()
            print(f"  {transcript}")

            # Check accuracy
            if "担ぎ" in transcript or "かつぎ" in transcript:
                status = "✅ Correct (katsugi)"
            elif "かつり" in transcript or "釣り" in transcript:
                status = "❌ Wrong (katsuri)"
            else:
                status = "🤔 Different"
            print(f"  {status}")
            results.append((model_name, transcript, status))
        except Exception as e:
            print(f"  Error: {e}")
            results.append((model_name, str(e), "⚠️ Error"))

    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    for model, transcript, status in results:
        print(f"{model:15} | {status}")

if __name__ == "__main__":
    main()
