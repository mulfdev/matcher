#!/bin/sh

docker run -it --rm postgres psql \
  -h yamabiko.proxy.rlwy.net \
  -p 20431 \
  -U mulf0 \
  -d jobs_rag \
  -c "DO \$\$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='job_postings_details' AND column_name='summary_embedding'
  ) THEN
    ALTER TABLE job_postings_details DROP COLUMN summary_embedding;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='job_postings_details' AND column_name='skill_embedding'
  ) THEN
    ALTER TABLE job_postings_details DROP COLUMN skill_embedding;
  END IF;

  ALTER TABLE job_postings_details 
    ADD COLUMN summary_embedding vector(1536),
    ADD COLUMN skill_embedding vector(1536);
END
\$\$;"

