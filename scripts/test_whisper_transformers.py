#!/usr/bin/env python3
"""Test Whisper models using transformers with proper chunking."""

import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
import subprocess
import tempfile
import os
import sys

def main():
    video_path = sys.argv[1] if len(sys.argv) > 1 else "cosmos_videos/f6e0c097-30a0-42cc-a380-2c3fba7d045a.mp4"
    model_id = sys.argv[2] if len(sys.argv) > 2 else "openai/whisper-large-v3"

    # Extract audio from video
    print("Extracting audio from video...")
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        audio_path = f.name

    subprocess.run([
        "ffmpeg", "-y", "-i", video_path,
        "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
        audio_path
    ], capture_output=True)

    print("=" * 60)
    print(f"MODEL: {model_id.split('/')[-1] if '/' in model_id else model_id}")
    print("=" * 60)

    # Load model
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    torch_dtype = torch.float16 if device == "mps" else torch.float32

    print(f"Using device: {device}")
    print("Loading model...")

    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        model_id,
        torch_dtype=torch_dtype,
        low_cpu_mem_usage=True,
        use_safetensors=True
    )
    model.to(device)

    processor = AutoProcessor.from_pretrained(model_id)

    # Use chunked long-form transcription
    pipe = pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        torch_dtype=torch_dtype,
        device=device,
        chunk_length_s=30,
        batch_size=1,
    )

    print("Running transcription...")
    result = pipe(
        audio_path,
        return_timestamps="word",
        generate_kwargs={
            "language": "ja",
            "task": "transcribe",
        }
    )

    # Print results
    print("\n" + "=" * 60)
    print("TRANSCRIPTION RESULTS:")
    print("=" * 60)

    if "chunks" in result:
        for chunk in result["chunks"]:
            ts = chunk.get("timestamp", (0, 0))
            start = ts[0] if ts[0] else 0
            end = ts[1] if ts[1] else 0
            print(f"{start:.1f}-{end:.1f}: {chunk['text']}")
    else:
        print("Full text:", result["text"])

    # Cleanup
    os.unlink(audio_path)

if __name__ == "__main__":
    main()
