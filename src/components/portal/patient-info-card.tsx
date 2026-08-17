import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Patient } from "@/data/mock";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function PatientInfoCard({ patient }: { patient: Patient }) {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base">Dados do paciente</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Nome" value={patient.nome} />
          <Field label="CPF" value={patient.cpf} />
          <Field label="Telefone" value={patient.telefone} />
          <Field label="E-mail" value={patient.email} />
          <Field label="Data de nascimento" value={patient.nascimento} />
        </dl>
      </CardContent>
    </Card>
  );
}

export { Field as InfoField };
