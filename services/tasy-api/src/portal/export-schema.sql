CREATE TABLE portal.tasy_exports (
  request_id uuid PRIMARY KEY REFERENCES portal.requests(id),
  actor_id uuid NOT NULL REFERENCES portal.users(id),
  tasy_username text NOT NULL,
  snapshot jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('sending','unknown','confirmed')),
  tasy_id text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON portal.tasy_exports FROM PUBLIC;
