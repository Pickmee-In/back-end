#!/usr/bin/env bash
set -euo pipefail
umask 077
backup_root=/var/www/pickme/backups
mkdir -p "$backup_root"
chmod 700 "$backup_root"
backup_stamp=$(date -u +%Y%m%dT%H%M%SZ)
runuser -u postgres -- pg_dump --format=custom pickme > "$backup_root/database-$backup_stamp.dump.tmp"
mv "$backup_root/database-$backup_stamp.dump.tmp" "$backup_root/database-$backup_stamp.dump"
tar -C /var/www/pickme/data -czf "$backup_root/uploads-$backup_stamp.tar.gz.tmp" uploads
mv "$backup_root/uploads-$backup_stamp.tar.gz.tmp" "$backup_root/uploads-$backup_stamp.tar.gz"
find "$backup_root" -maxdepth 1 -type f \( -name 'database-*.dump' -o -name 'uploads-*.tar.gz' \) -mtime +7 -delete
