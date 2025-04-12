#!/bin/sh

docker run -v $PWD/backup:/backup -it --rm postgres \
  pg_restore \
    --no-owner \
    --no-privileges \
    --verbose \
    --host=yamabiko.proxy.rlwy.net \
    --port=20431 \
    --username=mulf0 \
    --dbname=jobs_rag \
    /backup/backup.dump
