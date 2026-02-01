#!/bin/bash
# Usage: MAXMIND_LICENSE_KEY=your_key ./scripts/download-geoip.sh
set -e
DATA_DIR="${DATA_DIR:-./data}"
if [ -z "$MAXMIND_LICENSE_KEY" ]; then echo "Error: MAXMIND_LICENSE_KEY not set"; exit 1; fi
echo "Downloading GeoLite2-City..."
curl -sSL "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz" | tar xz --strip-components=1 -C "$DATA_DIR" --wildcards "*.mmdb"
echo "Downloading GeoLite2-ASN..."
curl -sSL "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-ASN&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz" | tar xz --strip-components=1 -C "$DATA_DIR" --wildcards "*.mmdb"
echo "Done: $(ls -la $DATA_DIR/*.mmdb)"
