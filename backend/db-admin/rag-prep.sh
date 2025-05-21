#!/bin/sh

docker run -it --rm postgres psql \
  -h yamabiko.proxy.rlwy.net \
  -p 20431 \
  -U mulf0 \
  -d jobs_rag \
  -c "ALTER TABLE job_postings_details ADD COLUMN external_id VARCHAR; ALTER TABLE job_postings_details ADD COLUMN collection VARCHAR;ALTER TABLE public.job_postings_details RENAME COLUMN description TO text;ALTER TABLE job_postings_details ADD COLUMN embeddings vector(1536);"

