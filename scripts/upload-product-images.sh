#!/usr/bin/env bash
set -u
ASSET_DIR="/home/ubuntu/webdev-static-assets/product-images"
LOG_FILE="/home/ubuntu/product-catalog-site/scripts/product-image-upload.log"
: > "$LOG_FILE"
mapfile -t files < <(find "$ASSET_DIR" -type f | sort)
total=${#files[@]}
for ((i=0; i<total; i+=40)); do
  batch=("${files[@]:i:40}")
  echo "Uploading batch $((i+1))-$((i+${#batch[@]})) of $total" | tee -a "$LOG_FILE"
  manus-upload-file --webdev "${batch[@]}" 2>&1 | tee -a "$LOG_FILE"
done
