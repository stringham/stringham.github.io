#!/bin/bash

# --- Configuration ---
# Adjust this FUZZ_FACTOR value (e.g., "5%", "10%", "15%")
# It determines how much color variation is tolerated for the flood fill.
# Start with a lower value and increase if needed.
# Higher values are more tolerant but risk making parts of your foreground transparent
# if their colors are too similar to the background within the texture.
FUZZ_FACTOR="10%"

# Check if an input file is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <input_file.png> [fuzz_factor]"
  echo "Example: $0 your_image.png"
  echo "Example: $0 your_image.png 15%"
  exit 1
fi

INPUT_FILE="$1"
if [ ! -f "${INPUT_FILE}" ]; then
    echo "Error: Input file '${INPUT_FILE}' not found."
    exit 1
fi

# Allow overriding FUZZ_FACTOR from command line
if [ -n "$2" ]; then
  FUZZ_FACTOR="$2"
  echo "Using custom fuzz factor from argument: ${FUZZ_FACTOR}"
else
  echo "Using default fuzz factor: ${FUZZ_FACTOR}"
fi


echo "Processing input file: ${INPUT_FILE}"

# --- Create standard icons ---
echo "Creating icon-192x192.png..."
convert "${INPUT_FILE}" -resize 192x192 "icon-192x192.png"

echo "Creating icon-512x512.png..."
convert "${INPUT_FILE}" -resize 512x512 "icon-512x512.png"

# --- Create favicon.ico (multiple sizes recommended for better compatibility) ---
echo "Creating favicon.ico..."
convert "${INPUT_FILE}" -bordercolor none -border 0 \
  \( -clone 0 -resize 16x16 \) \
  \( -clone 0 -resize 32x32 \) \
  \( -clone 0 -resize 48x48 \) \
  \( -clone 0 -resize 64x64 \) \
  -delete 0 -alpha off -colors 256 "favicon.ico"


# --- Create maskable icons with flood fill transparency ---
echo "--- Creating maskable icons ---"

echo "Creating icon-maskable-192x192.png..."
# -alpha set: Ensure the image has an alpha channel.
# -fuzz FUZZ_FACTOR: Define how similar colors need to be to be considered the same.
# -fill none: Specify that the matched area should be filled with transparency.
#             'none' and 'transparent' are often interchangeable here.
# -draw "matte 0,0 floodfill": Perform a flood fill on the alpha channel (matte)
#                               starting at pixel (0,0). It makes pixels matching
#                               the color at (0,0) (within the fuzz factor) transparent.
convert "${INPUT_FILE}" \
  -alpha set \
  -fuzz "${FUZZ_FACTOR}" \
  -fill none \
  -draw "matte 0,0 floodfill" \
  -resize 192x192 \
  "icon-maskable-192x192.png"

echo "Creating icon-maskable-512x512.png..."
convert "${INPUT_FILE}" \
  -alpha set \
  -fuzz "${FUZZ_FACTOR}" \
  -fill none \
  -draw "matte 0,0 floodfill" \
  -resize 512x512 \
  "icon-maskable-512x512.png"

echo "Done!"