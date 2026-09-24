CREATE TABLE portal.surgical_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name text NOT NULL CHECK (char_length(btrim(patient_name)) BETWEEN 1 AND 120),
  patient_cpf text NOT NULL CHECK (patient_cpf ~ '^[0-9]{11}$'),
  doctor_user_id uuid NOT NULL REFERENCES portal.users(id) ON DELETE RESTRICT,
  doctor_name text NOT NULL,
  desired_date date NOT NULL,
  status text NOT NULL DEFAULT 'solicitado' CHECK (status IN ('solicitado','confirmado','cancelado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX surgical_appointments_doctor_idx
  ON portal.surgical_appointments(doctor_user_id, desired_date);
CREATE INDEX surgical_appointments_status_idx
  ON portal.surgical_appointments(status, desired_date);