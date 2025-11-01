#!/bin/bash
# View deflate-compressed JSON files

if [ -z "$1" ]; then
    echo "Usage: $0 <character>"
    echo "Example: $0 极"
    exit 1
fi

CHAR="$1"
FILE="output_dictionary/${CHAR}.json.deflate"

if [ ! -f "$FILE" ]; then
    echo "Error: File not found: $FILE"
    exit 1
fi

echo "Decompressing: $FILE"
echo "---"
# Use -zlib.MAX_WBITS for raw deflate (no zlib header)
python3 -c "import zlib; import sys; sys.stdout.buffer.write(zlib.decompress(open('$FILE', 'rb').read(), -zlib.MAX_WBITS))" | jq

