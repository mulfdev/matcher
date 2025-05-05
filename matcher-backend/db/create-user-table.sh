#!/bin/sh

docker run -it --rm postgres psql \
  -h yamabiko.proxy.rlwy.net \
  -p 20431 \
  -U mulf0 \
  -d jobs_rag \
  -c "CREATE TABLE \"user\" (
    id                      TEXT        PRIMARY KEY,
    telegram_id             TEXT,
    skills                  TEXT[]      NOT NULL,
    experience              JSONB       NOT NULL,
    total_experience_years  NUMERIC(4,1) NOT NULL,
    career_level            VARCHAR(10) NOT NULL
                              CHECK (career_level IN ('entry','mid','senior','staff')),
    category                TEXT        NOT NULL,
    summary                 TEXT        NOT NULL
  );"
