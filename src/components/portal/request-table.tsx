import { Link } from "@tanstack/react-router";
import { RequestActions } from "./request-actions";
import { DoctorFeeDialog } from "./doctor-fee-dialog";
import { ArrowRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";
import { RequestCard } from "./request-card";
import { formatCurrency, totalOf, type ConsultationRequest } from "@/data/mock";
import { useSession } from "@/lib/auth/session";

export function RequestTable({
  requests,
  showNumber = true,
  manage = false,
}: {
  requests: ConsultationRequest[];
  showNumber?: boolean;
  manage?: boolean;
}) {
  const { user } = useSession();
  const isMedico = user?.perfil === "Médico";

  return (
    <>
      {/* Mobile: cards */}
      <div className="grid gap-3 md:hidden">
        {requests.map((r) => (
          <div key={r.id} className="space-y-2">
            <RequestCard request={r} />
            {isMedico && <DoctorFeeDialog request={r} />}
            {manage && <RequestActions request={r} />}
          </div>
        ))}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-card md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {showNumber ? <TableHead>Nº</TableHead> : null}
                <TableHead>Paciente</TableHead>
                <TableHead>Médico</TableHead>
                <TableHead>Procedimento</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  {showNumber ? (
                    <TableCell className="font-medium text-muted-foreground">{r.numero}</TableCell>
                  ) : null}
                  <TableCell className="font-medium text-foreground">{r.paciente.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{r.medico}</TableCell>
                  <TableCell className="text-muted-foreground">{r.especialidade}</TableCell>
                  <TableCell className="text-muted-foreground">{r.data}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(totalOf(r))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex flex-wrap items-center justify-end gap-1">
                      {isMedico && <DoctorFeeDialog request={r} />}
                      {manage && !isMedico && <RequestActions request={r} />}
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/orcamentos/$id" params={{ id: r.id }}>
                          Visualizar <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
