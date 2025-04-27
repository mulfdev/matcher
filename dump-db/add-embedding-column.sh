#!/bin/sh

docker run -it --rm postgres psql \
  -h yamabiko.proxy.rlwy.net \
  -p 20431 \
  -U mulf0 \
  -d jobs_rag \
  -c "ALTER TABLE job_postings_details ADD COLUMN summary_embedding vector(1536); ALTER TABLE job_postings_details ADD COLUMN skill_embedding vector(1536);"
