#!/bin/sh
set -eu

source_path="${GOOGLE_APPLICATION_CREDENTIALS_SOURCE:-/app/cle.json}"
target_path="${GOOGLE_APPLICATION_CREDENTIALS:-/app/storage/google-credentials.json}"

if [ -f "$source_path" ]; then
  mkdir -p "$(dirname "$target_path")"
  cp "$source_path" "$target_path"
  chmod 600 "$target_path" || true
elif [ "${DRIVE_ENABLED:-false}" = "true" ]; then
  echo "Missing Google credentials file: $source_path" >&2
  exit 1
fi

exec "$@"