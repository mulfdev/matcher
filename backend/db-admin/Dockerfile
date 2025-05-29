
# Use the official PostgreSQL image from Docker Hub
FROM postgres:latest

# Set environment variables for PostgreSQL connection
ENV PGHOST=aws-0-us-west-1.pooler.supabase.com
ENV PGPORT=6543
ENV PGDATABASE=postgres
ENV PGUSER=postgres.zpdtjvlltxlfrzeicete
# It's recommended to pass PGPASSWORD at runtime for security reasons

# Set the default command to run when the container starts
CMD ["bash", "-c", "pg_dump --no-owner --no-privileges --format=custom -t public.job_postings_details -t public.job_postings --file=/backup/backup.dump"]

