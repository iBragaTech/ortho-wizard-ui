CREATE TABLE portal.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES portal.requests(id),
  actor_id uuid NOT NULL REFERENCES portal.users(id),
  kind text NOT NULL CHECK (kind IN ('new_request','patient_quote')),
  recipient text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  snapshot jsonb NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','sending','sent','failed','unknown')),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX email_outbox_pending_idx ON portal.email_outbox(state,created_at);
REVOKE ALL ON portal.email_outbox FROM PUBLIC;
