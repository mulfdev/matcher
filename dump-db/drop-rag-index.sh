#!/bin/sh

docker run -it --rm postgres psql \
  -h yamabiko.proxy.rlwy.net \
  -p 20431 \
  -U mulf0 \
  -d jobs_rag \
  -c "DROP INDEX IF EXISTS job_postings_details_skill_embedding_idx;
DROP INDEX IF EXISTS job_postings_details_summary_embedding_idx;"

