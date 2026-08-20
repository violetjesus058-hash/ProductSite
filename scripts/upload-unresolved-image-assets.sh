#!/usr/bin/env bash
set -euo pipefail
cd /home/ubuntu/product-catalog-site
: > scripts/unresolved-image-upload.log
split -d -l 25 scripts/unresolved-image-upload-paths.txt /tmp/unresolved-image-batch-
for batch in /tmp/unresolved-image-batch-*; do
  [ -s "$batch" ] || continue
  mapfile -t files < "$batch"
  manus-upload-file --webdev "${files[@]}" >> scripts/unresolved-image-upload.log 2>&1
  rm -f "$batch"
done
printf 'uploaded batches; log at scripts/unresolved-image-upload.log\n'
