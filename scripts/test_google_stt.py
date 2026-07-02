#!/usr/bin/env python3
"""Test Google Cloud Speech-to-Text on the problematic video.

Expected transcription at ~28 seconds: 神輿担ぎポーズ (mikoshi katsugi pose)
Whisper consistently produces: みこしかつりポーズ (mikoshi katsuri pose)

Let's see if Google's different model architecture does better!
"""

import os
import subprocess
from pathlib import Path
from google.cloud import speech

# Set credentials
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.expanduser("~/kiokun-stt-key.json")

def extract_audio_segment(video_path: str, output_path: str, start_time: float = 25.0, duration: float = 10.0):
    """Extract a segment of audio from video."""
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-ss", str(start_time),
        "-t", str(duration),
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        output_path
    ]
    subprocess.run(cmd, capture_output=True)
    print(f"Extracted audio segment: {output_path}")

def transcribe_with_google(audio_path: str, language_code: str = "ja-JP"):
    """Transcribe audio using Google Cloud Speech-to-Text."""
    client = speech.SpeechClient()

    with open(audio_path, "rb") as audio_file:
        content = audio_file.read()

    audio = speech.RecognitionAudio(content=content)
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        language_code=language_code,
        enable_word_time_offsets=True,
        enable_automatic_punctuation=True,
    )

    print(f"\nTranscribing with Google Cloud Speech-to-Text ({language_code})...")
    response = client.recognize(config=config, audio=audio)

    return response

def main():
    # The problematic video
    video_id = "f6e0c097-30a0-42cc-a380-2c3fba7d045a"
    video_path = f"cosmos_videos/{video_id}.mp4"

    if not Path(video_path).exists():
        print(f"Video not found: {video_path}")
        return

    # Extract the relevant segment (around 25-35 seconds)
    audio_segment = "/tmp/test_segment.wav"
    extract_audio_segment(video_path, audio_segment, start_time=25.0, duration=10.0)

    # Transcribe with Google
    response = transcribe_with_google(audio_segment)

    print("\n" + "="*60)
    print("GOOGLE CLOUD SPEECH-TO-TEXT RESULTS")
    print("="*60)
    print("\nExpected: 神輿担ぎポーズ (mikoshi katsugi pose)")
    print("Whisper:  みこしかつりポーズ (mikoshi katsuri pose)")
    print("\n" + "-"*60)

    for result in response.results:
        alternative = result.alternatives[0]
        print(f"\nTranscript: {alternative.transcript}")
        print(f"Confidence: {alternative.confidence:.2%}")

        if alternative.words:
            print("\nWord timestamps:")
            for word in alternative.words:
                start = word.start_time.total_seconds()
                end = word.end_time.total_seconds()
                print(f"  {start:.2f}s - {end:.2f}s: {word.word}")

    print("\n" + "="*60)

    # Check if it got the right transcription
    full_transcript = " ".join([r.alternatives[0].transcript for r in response.results])
    if "担ぎ" in full_transcript or "かつぎ" in full_transcript:
        print("✅ Google correctly transcribed 'katsugi'!")
    elif "かつり" in full_transcript or "釣り" in full_transcript:
        print("❌ Google also mishears it as 'katsuri' - same as Whisper")
    else:
        print(f"🤔 Different result: {full_transcript}")

if __name__ == "__main__":
    main()
