CREATE TABLE portal.budget_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  nome varchar(120) NOT NULL,
  dados jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX budget_templates_owner_name ON portal.budget_templates(user_id, lower(nome));
