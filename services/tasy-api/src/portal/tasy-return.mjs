import { createHash } from "node:crypto";

export function returnStatus(snapshot, approvalRule) {
  if (!["status_and_document", "document"].includes(approvalRule))
    throw new Error("Regra de aprovação Tasy não definida.");
  if (snapshot.statusCode === 3) return "cancelado_paciente";
  if (snapshot.statusCode === 4) return "cancelado_estabelecimento";
  if (snapshot.receipt && (approvalRule === "document" || snapshot.statusCode === 2))
    return "concluido";
  return (
    {
      1: "em_aprovacao",
      2: "aguardando_pagamento",
      5: "aguardando_cotacao",
      6: "aguardando_documentacao",
    }[snapshot.statusCode] ?? "pendente"
  );
}

export function createReturnSync({ db, read, approvalRule }) {
  // The rule must be explicitly configured; enabling sync never silently chooses approval policy.
  returnStatus({ statusCode: 5, receipt: false }, approvalRule);
  let running;
  const run = async () => {
    const { rows } = await db.query(`SELECT e.request_id,e.tasy_id,e.snapshot,e.actor_id
      FROM portal.tasy_exports e JOIN portal.requests r ON r.id=e.request_id
      WHERE e.state='confirmed' AND COALESCE(r.data->>'excluido','false') <> 'true'
      ORDER BY COALESCE(r.data->'tasyRetorno'->>'consultadoEm',''),e.request_id LIMIT 100`);
    for (const row of rows) {
      try {
        const snapshot = await read({
          id: row.request_id,
          tasyId: row.tasy_id,
          patientId: row.snapshot.data.tasy.cdPessoaFisica,
          establishment: row.snapshot.context.establishment,
        });
        const status = returnStatus(snapshot, approvalRule);
        const hash = createHash("sha256")
          .update(JSON.stringify({ snapshot, approvalRule }))
          .digest("hex");
        const checkedAt = new Date().toISOString();
        await db.transaction(async (tx) => {
          const current = (
            await tx.query("SELECT data,status FROM portal.requests WHERE id=$1 FOR UPDATE", [
              row.request_id,
            ])
          ).rows[0];
          const complete =
            Number.isFinite(snapshot.total) &&
            snapshot.total >= 0 &&
            snapshot.itens.length > 0 &&
            snapshot.itens.every(
              (i) => Number.isFinite(i.total) && Number.isFinite(i.quantidade) && i.quantidade > 0,
            );
          const fees = snapshot.itens
            .filter((i) => i.contabilizado)
            .reduce((sum, i) => sum + i.medico, 0);
          const retorno = {
            ...snapshot,
            hash,
            completo: complete,
            consultadoEm: checkedAt,
            erro: null,
            approvalRule,
          };
          const data = {
            ...current.data,
            tasyGerenciado: true,
            tasyRetorno: retorno,
            honorariosMedicos: complete ? Math.round(fees * 100) / 100 : null,
            // The native quote total does not establish that VL_MEDICO is included.
            // Preserve it directly; subtracting the separately recorded fees invents negatives.
            valorHospitalar: complete ? Math.round(snapshot.total * 100) / 100 : null,
            diaria: null,
            cti: null,
            dataAprovacao:
              status === "concluido"
                ? (approvalRule === "document" ? snapshot.receiptAt : snapshot.approvedAt)
                  ? `${approvalRule === "document" ? snapshot.receiptAt : snapshot.approvedAt}-03:00`
                  : null
                : null,
          };
          await tx.query(
            "UPDATE portal.requests SET data=$2::jsonb,status=$3,updated_at=now() WHERE id=$1",
            [row.request_id, JSON.stringify(data), status],
          );
          if (current.data.tasyRetorno?.hash !== hash)
            await tx.query(
              "INSERT INTO portal.events(request_id,actor_id,titulo,descricao) VALUES ($1,$2,$3,$4)",
              [
                row.request_id,
                row.actor_id,
                "Orçamento atualizado pelo Tasy",
                JSON.stringify({
                  origem: "Tasy",
                  status: snapshot.statusLabel,
                  total: snapshot.total,
                  comprovante: snapshot.receipt,
                }),
              ],
            );
        });
      } catch {
        // Preserve last good snapshot and approval state; flag failure without exposing Oracle details.
        await db.query(
          `UPDATE portal.requests SET data=jsonb_set(data,'{tasyRetorno}',
          COALESCE(data->'tasyRetorno','{}'::jsonb) || jsonb_build_object('erro','Consulta ao Tasy indisponível.','consultadoEm',$2::text))
          WHERE id=$1`,
          [row.request_id, new Date().toISOString()],
        );
      }
    }
  };
  return {
    sync: () =>
      (running ??= run().finally(() => {
        running = undefined;
      })),
  };
}
