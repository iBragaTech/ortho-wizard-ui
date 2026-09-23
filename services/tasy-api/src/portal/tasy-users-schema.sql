CREATE TABLE portal.tasy_user_links (
  user_id uuid PRIMARY KEY REFERENCES portal.users(id),
  nm_usuario varchar(15) NOT NULL,
  principal jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tasy_user_links_username ON portal.tasy_user_links(lower(nm_usuario));
CREATE TABLE portal.tasy_user_link_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES portal.users(id),
  actor_id uuid REFERENCES portal.users(id),
  anterior jsonb,
  novo jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
