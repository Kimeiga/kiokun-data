#!/usr/bin/env python3
"""Runner script for Chinese video transcription."""

import os
import sys

# Set up output redirection
LOG_FILE = "/Users/haki/code/kiokun-data/chinese_transcription.log"
sys.stdout = open(LOG_FILE, "w")
sys.stderr = sys.stdout

# Change to project directory
os.chdir("/Users/haki/code/kiokun-data")

# Import and run the transcription
sys.path.insert(0, "scripts")
from chinese_video_to_dictionary import process_batch

# Run batch processing
video_dir = "cosmos_chinese_videos"
print(f"Starting Chinese video transcription from {video_dir}")
process_batch(video_dir)
print("Done!")

