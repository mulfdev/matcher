#!/bin/sh

docker run -it --rm postgres psql \
  -h yamabiko.proxy.rlwy.net \
  -p 20431 \
  -U mulf0 \
  -d jobs_rag \
  -c "DROP TABLE user_job_feedback;"
