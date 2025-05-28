DB_HOST="yamabiko.proxy.rlwy.net"
DB_PORT="20431"
DB_USER="mulf0"
DB_NAME="jobs_rag"

docker run -it --rm postgres psql \
  "$DATABASE_URL" \
  -c 'CREATE TABLE IF NOT EXISTS "sessions" (
  "sid" VARCHAR NOT NULL COLLATE "default",
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = ''sessions_pkey''
  ) THEN
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS "IDX_sessions_expire" ON "sessions" ("expire");
'
