#!/bin/sh

if [ -f "../.env" ]; then
  export $(grep -v '^#' ../.env | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL not found in environment variables"
  exit 1
fi

docker run -it --rm postgres psql \
  "$DATABASE_URL" \
  -c "DROP TABLE IF EXISTS \"user_profile\";
  DROP TABLE IF EXISTS \"user\";
  
  CREATE TABLE \"user\" (
    id              TEXT        PRIMARY KEY,
    oauth_user_id   TEXT        NOT NULL,
    oauth_provider  TEXT        NOT NULL,
    email           TEXT        NOT NULL,
    name            TEXT        NOT NULL
  );
  
  CREATE TABLE \"user_profile\" (
    user_id                 TEXT        PRIMARY KEY REFERENCES \"user\"(id) ON DELETE CASCADE,
    career_level            VARCHAR(10) NOT NULL
                              CHECK (career_level IN ('entry','mid','senior','staff')),
    total_experience_years  NUMERIC(4,1) NOT NULL,
    experience              JSONB       NOT NULL,
    skills                  TEXT[]      NOT NULL,
    category                TEXT        NOT NULL,
    summary                 TEXT        NOT NULL,
    summary_embedding vector(1536),
    skill_embedding vector(1536)
  );"
