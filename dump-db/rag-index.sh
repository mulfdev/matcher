#!/bin/sh

docker run -it --rm postgres psql \
  -h yamabiko.proxy.rlwy.net \
  -p 20431 \
  -U mulf0 \
  -d jobs_rag \
  -c "CREATE INDEX ON job_postings_details
  USING ivfflat (summary_embedding vector_l2_ops)
  WITH (lists = 100);CREATE INDEX ON job_postings_details
  USING ivfflat (skill_embedding vector_l2_ops)
  WITH (lists = 100);" 
