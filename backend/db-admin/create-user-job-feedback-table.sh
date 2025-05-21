#!/bin/sh

docker run -it --rm postgres psql \
  -h yamabiko.proxy.rlwy.net \
  -p 20431 \
  -U mulf0 \
  -d jobs_rag \
  -c "CREATE TABLE IF NOT EXISTS user_job_feedback (
        user_id TEXT    NOT NULL,
        job_id  BIGINT  NOT NULL,
        liked   BOOLEAN NOT NULL,
        PRIMARY KEY (user_id, job_id)
    );"

