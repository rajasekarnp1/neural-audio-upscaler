#!/bin/bash

# Neural Audio Upscaler shell script

# Function to show help
show_help() {
  echo "Neural Audio Upscaler"
  echo "Usage: $0 [options] <input_file> <output_file>"
  echo ""
  echo "Options:"
  echo "  --no-preprocessing     Disable audio preprocessing"
  echo "  --no-postprocessing    Disable audio postprocessing"
  echo "  --training-mode        Enable training mode (model will learn from this example)"
  echo "  --audio-type <type>    Force audio type (voice, music, ambient, general)"
  echo "  --help                 Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0 input.mp3 output.wav"
  echo "  $0 --no-preprocessing input.mp3 output.wav"
  echo "  $0 --training-mode input.mp3 output.wav"
  exit 0
}

# Parse arguments
OPTIONS=""
INPUT_FILE=""
OUTPUT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help)
      show_help
      ;;
    --no-preprocessing|--no-postprocessing|--training-mode)
      OPTIONS="$OPTIONS $1"
      shift
      ;;
    --audio-type)
      if [[ $# -lt 2 ]]; then
        echo "Error: --audio-type requires an argument"
        exit 1
      fi
      OPTIONS="$OPTIONS $1 $2"
      shift 2
      ;;
    *)
      if [[ -z "$INPUT_FILE" ]]; then
        INPUT_FILE="$1"
      elif [[ -z "$OUTPUT_FILE" ]]; then
        OUTPUT_FILE="$1"
      else
        echo "Error: Too many arguments"
        show_help
      fi
      shift
      ;;
  esac
done

# Check if input and output files are provided
if [[ -z "$INPUT_FILE" || -z "$OUTPUT_FILE" ]]; then
  echo "Error: Input and output files are required"
  show_help
fi

# Check if input file exists
if [[ ! -f "$INPUT_FILE" ]]; then
  echo "Error: Input file '$INPUT_FILE' does not exist."
  exit 1
fi

# Run the upscaler
node cli.js $OPTIONS "$INPUT_FILE" "$OUTPUT_FILE"