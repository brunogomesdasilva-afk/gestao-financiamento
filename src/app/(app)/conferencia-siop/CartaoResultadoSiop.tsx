import type { CampoConferido, ResultadoUnidade, SituacaoConferencia } from "@/lib/siop";

export function moedaSiop(valor: number | null) {
  return valor == null ? "—" : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const SITUACAO_SIOP: Record<SituacaoConferencia, { rotulo: string; estilo: string; ordem: number }> = {
  divergente: { rotulo: "Divergente", estilo: "bg-red-100 text-red-800", ordem: 0 },
  incompleto: { rotulo: "Incompleto", estilo: "bg-amber-100 text-amber-800", ordem: 1 },
  ilegivel: { rotulo: "PDF ilegível", estilo: "bg-red-50 text-red-700", ordem: 2 },
  "sem-pdf": { rotulo: "Sem PDF", estilo: "bg-slate-200 text-slate-700", ordem: 3 },
  conferido: { rotulo: "Conferido", estilo: "bg-emerald-100 text-emerald-800", ordem: 4 },
};

function ResultadoCampo({ campo }: { campo: CampoConferido }) {
  switch (campo.resultado) {
    case "igual":
      return <span className="font-medium text-emerald-700">✓ Igual</span>;
    case "diferente":
      return (
        <span className="font-medium text-red-700">
          ✗ Diferente (sistema − PDF = {moedaSiop((campo.sistema ?? 0) - (campo.pdf ?? 0))})
        </span>
      );
    case "sem-sistema":
      return <span className="font-medium text-amber-700">Não preenchido no sistema</span>;
    default:
      return <span className="text-slate-500">Não encontrado no PDF</span>;
  }
}

// Cartão com o resultado da conferência de uma unidade: campos comparados, identificação do imóvel
// e avisos. Usado tanto na conferência por pasta (várias unidades) quanto na avulsa (uma só).
export function CartaoResultadoSiop({ r }: { r: ResultadoUnidade }) {
  const situacao = SITUACAO_SIOP[r.situacao];
  return (
    <details open={r.situacao !== "conferido"} className="rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="text-sm font-medium text-slate-900">
          {r.torre} · Unidade {r.unidade}
          {r.proprietario ? <span className="font-normal text-slate-500"> · {r.proprietario}</span> : null}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${situacao.estilo}`}>{situacao.rotulo}</span>
      </summary>

      <div className="space-y-3 border-t border-slate-200 px-4 py-3 text-sm">
        <p className="text-xs text-slate-500">
          Arquivo: {r.arquivo ?? "não encontrado na pasta do empreendimento"}
          {r.proponente ? ` · Proponente no PDF: ${r.proponente}` : ""}
        </p>

        {r.identificacao && (
          <p className={r.identificacao.igual ? "text-slate-600" : "rounded-md bg-red-50 px-3 py-2 text-red-700"}>
            <strong>Identificação do imóvel:</strong> sistema — {r.identificacao.sistema} · PDF —{" "}
            {r.identificacao.pdf}
            {r.identificacao.igual ? " ✓" : " ✗ o PDF descreve outra unidade"}
          </p>
        )}

        {r.campos.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1 pr-3 font-medium">Campo</th>
                <th className="py-1 pr-3 text-right font-medium">Sistema</th>
                <th className="py-1 pr-3 text-right font-medium">PDF (SIOP)</th>
                <th className="py-1 font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {r.campos.map((c) => (
                <tr key={c.chave}>
                  <td className="py-1.5 pr-3 text-slate-700">{c.rotulo}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-700">{moedaSiop(c.sistema)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-700">{moedaSiop(c.pdf)}</td>
                  <td className="py-1.5">
                    <ResultadoCampo campo={c} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {r.avisos.map((a) => (
          <p key={a} className="text-xs text-amber-700">
            {a}
          </p>
        ))}
      </div>
    </details>
  );
}
