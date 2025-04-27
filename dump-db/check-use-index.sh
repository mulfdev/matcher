docker run -it --rm postgres psql \
  -h yamabiko.proxy.rlwy.net \
  -p 20431 \
  -U mulf0 \
  -d jobs_rag \
  -c "EXPLAIN ANALYZE
SELECT j.id, j.title
FROM job_postings_details j
ORDER BY j.combined_embedding
         <-> (SELECT combined_embedding
               FROM job_postings_details
               LIMIT 1)
LIMIT 5;"
