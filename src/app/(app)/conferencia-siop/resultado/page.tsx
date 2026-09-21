import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPerfilAtual } from "@/lib/auth";
import { buscarTodos } from "@/lib/paginacao";
import type { Cliente, Empreendimento, Torre, Unidade } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  conferirEmpreendimento,
  type CampoConferido,
  type ClienteParaConferir,
  type ResultadoUnidade,
  type SituacaoConferencia,
} from "@/lib/siop";

function moeda(valor: number | null) {
  return valor == null ? "—" : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const SITUACAO: Record<SituacaoConferencia, { rotulo: string; estilo: string; ordem: number }> = {
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
          ✗ Diferente (sistema − PDF = {moeda((campo.sistema ?? 0) - (campo.pdf ?? 0))})
        </span>
      );
    case "sem-sistema":
      return <span className="font-medium text-amber-700">Não preenchido no sistema</span>;
    default:
      return <span className="text-slate-500">Não encontrado no PDF</span>;
  }
}

function Cartao({ r }: { r: ResultadoUnidade }) {
  const situacao = SITUACAO[r.situacao];
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
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-700">{moeda(c.sistema)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-700">{moeda(c.pdf)}</td>
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

export default async function ResultadoConferenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ empreendimento?: string }>;
}) {
  const { empreendimento: empreendimentoId } = await searchParams;
  if (!empreendimentoId) redirect("/conferencia-siop/nova");

  const atual = await getPerfilAtual();
  const supabase = await createClient();

  const { data: empreendimentoData } = await supabase
    .from("empreendimentos")
    .select("*")
    .eq("id", empreendimentoId)
    .single();
  if (!empreendimentoData) notFound();
  const empreendimento = empreendimentoData as Empreendimento;

  const [{ data: clientesData }, { data: torresData }, unidades] = await Promise.all([
    supabase.from("clientes").select("*").eq("empreendimento_id", empreendimentoId).eq("arquivado", false),
    supabase.from("torres").select("*").eq("empreendimento_id", empreendimentoId),
    buscarTodos<Pick<Unidade, "id" | "torre_id" | "numero">>((de, ate) =>
      supabase.from("unidades").select("id, torre_id, numero").order("id").range(de, ate)
    ),
  ]);

  const torrePorId = new Map(((torresData ?? []) as Torre[]).map((t) => [t.id, t]));
  const unidadePorId = new Map(unidades.map((u) => [u.id, u]));

  const paraConferir: ClienteParaConferir[] = [];
  for (const c of (clientesData ?? []) as Cliente[]) {
    const unidade = c.unidade_id ? unidadePorId.get(c.unidade_id) : undefined;
    const torre = unidade ? torrePorId.get(unidade.torre_id) : undefined;
    if (!unidade || !torre) continue;
    paraConferir.push({
      clienteId: c.id,
      unidade: unidade.numero,
      torre: torre.nome,
      proprietario: c.nome,
      valorCompra: c.valor_compra ?? null,
      financiamento: c.financiamento_contratado,
      fgts: c.fgts_contratado,
      terreno: c.terreno,
    });
  }
  paraConferir.sort(
    (a, b) =>
      a.torre.localeCompare(b.torre, "pt-BR", { numeric: true }) ||
      a.unidade.localeCompare(b.unidade, "pt-BR", { numeric: true })
  );

  const conferencia = await conferirEmpreendimento(empreendimento.nome, paraConferir);
  const resultados = [...conferencia.resultados].sort(
    (a, b) => SITUACAO[a.situacao].ordem - SITUACAO[b.situacao].ordem
  );
  const contagem = (s: SituacaoConferencia) => resultados.filter((r) => r.situacao === s).length;

  return (
    <div>
      <Link href="/conferencia-siop/nova" className="text-xs text-slate-500 hover:text-slate-900">
        ← Nova conferência
      </Link>
      <h1 className="mt-1 text-lg font-semibold text-slate-900">Conferência SIOP · {empreendimento.nome}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {paraConferir.length} unidade(s) em carteira
        {conferencia.pastaDoEmpreendimento ? ` · pasta: SIOP/${conferencia.pastaDoEmpreendimento}` : ""}
      </p>

      {conferencia.erro ? (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {conferencia.erro}
          <span className="mt-1 block text-xs text-red-600">Pasta procurada: {conferencia.pasta}</span>
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(SITUACAO) as SituacaoConferencia[]).map((s) => (
              <span key={s} className={`rounded-full px-3 py-1 text-xs font-medium ${SITUACAO[s].estilo}`}>
                {SITUACAO[s].rotulo}: {contagem(s)}
              </span>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {resultados.map((r) => (
              <Cartao key={r.clienteId} r={r} />
            ))}
            {resultados.length === 0 && (
              <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                Nenhuma unidade em carteira neste empreendimento para conferir.
              </p>
            )}
          </div>

          {atual?.perfil === "admin" && conferencia.pdfsSemCadastro.length > 0 && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              <h2 className="text-sm font-semibold text-slate-900">
                PDFs na pasta sem unidade em carteira ({conferencia.pdfsSemCadastro.length})
              </h2>
              <p className="mt-2 text-xs">{conferencia.pdfsSemCadastro.join(" · ")}</p>
            </div>
          )}
          {conferencia.arquivosNaoReconhecidos.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
              <h2 className="text-sm font-semibold">Arquivos com nome fora do padrão (ignorados)</h2>
              <p className="mt-2 text-xs">{conferencia.arquivosNaoReconhecidos.join(" · ")}</p>
              <p className="mt-1 text-xs">O nome deve ser assim: SIOP - Unidade - Torre (ex.: SIOPI - 103 - A.pdf).</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
