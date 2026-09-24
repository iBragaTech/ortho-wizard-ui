CREATE POLICY "Bloquear leitura direta de agendamentos"
ON public.surgical_appointments
FOR SELECT
TO anon, authenticated
USING (false);

CREATE POLICY "Bloquear cadastro direto de agendamentos"
ON public.surgical_appointments
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "Bloquear alteração direta de agendamentos"
ON public.surgical_appointments
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Bloquear exclusão direta de agendamentos"
ON public.surgical_appointments
FOR DELETE
TO anon, authenticated
USING (false);