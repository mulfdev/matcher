#!/bin/sh

docker run -it --rm postgres psql \
  -h ballast.proxy.rlwy.net \
  -p 14533 \
  -U mulf0 \
  -d jobs_rag \
  -c "ALTER TABLE job_postings_details ADD COLUMN embeddings vector(1536);"
