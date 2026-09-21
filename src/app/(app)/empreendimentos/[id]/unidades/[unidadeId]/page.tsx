import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/auth";
import { formatarValorHistorico } from "@/lib/historico";
import {
  CAMPO_LABEL,
  CAMPO_UNIDADE_LABEL,
  type AndamentoHistorico,
  type Cliente,
  type Etapa,
  type HistoricoAlteracao,
  type HistoricoUnidade,
  type ModalidadeFinanciamento,
  type Profile,
  type Torre,
  type Unidade,
} from "@/lib/database.types";

const ORIGEM_ESTILO = {
  Unidade: "bg-slate-100 text-slate-600",
  Andamento: "bg-sky-100 text-sky-700",
  Cadastro: "bg-amber-100 text-amber-700",
} as const;

type Evento = {
  chave: string;
  data: string;
  origem: keyof typeof ORIGEM_ESTILO;
  titulo: string;
  antes?: string;
  depois?: string;
  detalhe?: string | null;
  usuarioId: string | null;
  semUsuario: string;
};

function formatData(data: string) {
  return new Date(data).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

export default async function HistoricoUnidadePage({
  params,
}: {
  params: Promise<{ id: string; unidadeId: string }>;
}) {
  await exigirAdmin();
  const { id, unidadeId } = await params;
  const supabase = await createClient();

  const [
    { data: unidade },
    { data: historicoUnidade },
    { data: usuarios },
    { data: clientesData },
    { data: etapasData },
    { data: modalidadesData },
  ] = await Promise.all([
    supabase.from("unidades").select("*").eq("id", unidadeId).single(),
    supabase.from("historico_unidades").select("*").eq("unidade_id", unidadeId),
    supabase.from("profiles").select("*"),
    supabase.from("clientes").select("*").eq("unidade_id", unidadeId),
    supabase.from("etapas").select("*"),
    supabase.from("modalidades_financiamento").select("*"),
  ]);

  if (!unidade) notFound();
  const unidadeTyped = unidade as Unidade;
  const clientes = (clientesData ?? []) as Cliente[];
  const clienteIds = clientes.map((c) => c.id);

  const [{ data: torre }, { data: andamentoData }, { data: alteracoesData }] = await Promise.all([
    supabase.from("torres").select("*").eq("id", unidadeTyped.torre_id).single(),
    clienteIds.length
      ? supabase.from("andamento_historico").select("*").in("cliente_id", clienteIds)
      : Promise.resolve({ data: [] }),
    clienteIds.length
      ? supabase.from("historico_alteracoes").select("*").in("cliente_id", clienteIds)
      : Promise.resolve({ data: [] }),
  ]);

  const torreTyped = torre as Torre | null;
  const usuarioPorId = new Map<string, Profile>(((usuarios ?? []) as Profile[]).map((u) => [u.id, u]));
  const etapaPorId = new Map<string, Etapa>(((etapasData ?? []) as Etapa[]).map((e) => [e.id, e]));
  const modalidadePorId = new Map<string, string>(
    ((modalidadesData ?? []) as ModalidadeFinanciamento[]).map((m) => [m.id, m.nome])
  );

  const formatarValor = (campo: string, valor: string | null) =>
    formatarValorHistorico(campo, valor, { modalidadePorId, usuarioPorId });

  const eventos: Evento[] = [];

  for (const h of (historicoUnidade ?? []) as HistoricoUnidade[]) {
    eventos.push({
      chave: `u-${h.id}`,
      data: h.created_at,
      origem: "Unidade",
      titulo: `${CAMPO_UNIDADE_LABEL[h.campo] ?? h.campo} alterado`,
      antes: h.valor_anterior ?? "—",
      depois: h.valor_novo ?? "—",
      usuarioId: h.usuario_id,
      semUsuario: "importação/sistema",
    });
  }

  for (const a of (andamentoData ?? []) as AndamentoHistorico[]) {
    eventos.push({
      chave: `a-${a.id}`,
      data: a.created_at,
      origem: "Andamento",
      titulo: etapaPorId.get(a.etapa_id ?? "")?.nome ?? "Andamento",
      detalhe: a.observacao,
      usuarioId: a.usuario_id,
      semUsuario: "sistema",
    });
  }

  for (const c of (alteracoesData ?? []) as HistoricoAlteracao[]) {
    eventos.push({
      chave: `c-${c.id}`,
      data: c.created_at,
      origem: "Cadastro",
      titulo: `${CAMPO_LABEL[c.campo] ?? c.campo} alterado`,
      antes: formatarValor(c.campo, c.valor_anterior),
      depois: formatarValor(c.campo, c.valor_novo),
      usuarioId: c.usuario_id,
      semUsuario: "sistema",
    });
  }

  eventos.sort((x, y) => y.data.localeCompare(x.data));

  const emCarteira = clientes.find((c) => !c.arquivado);
  const analistaAtual = emCarteira?.analista_responsavel_id
    ? usuarioPorId.get(emCarteira.analista_responsavel_id)?.nome
    : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/empreendimentos/${id}`} className="text-xs text-slate-500 hover:text-slate-900">
        ← Voltar para o empreendimento
      </Link>
      <h1 className="mt-1 text-lg font-semibold text-slate-900">
        Unidade {unidadeTyped.numero}
        {torreTyped ? ` · ${torreTyped.nome}` : ""}
      </h1>
      <p className="text-sm text-slate-500">
        Status atual: {unidadeTyped.status} · Carteira:{" "}
        {emCarteira ? (analistaAtual ?? "sem analista") : "sem analista (disponível)"}
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Histórico da unidade</h2>
        <p className="mt-1 text-xs text-slate-400">
          Mudanças do espelho de vendas, andamento da análise (assumida, devolvida, etapas) e alterações
          de cadastro.
        </p>
        <ol className="mt-4 space-y-4">
          {eventos.map((e) => {
            const usuario = e.usuarioId ? usuarioPorId.get(e.usuarioId) : null;
            return (
              <li key={e.chave} className="border-l-2 border-slate-200 pl-4 text-sm">
                <p className="flex flex-wrap items-center gap-2 text-slate-900">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${ORIGEM_ESTILO[e.origem]}`}>
                    {e.origem}
                  </span>
                  <span className="font-medium">{e.titulo}</span>
                </p>
                {e.antes !== undefined && (
                  <p className="mt-0.5 text-slate-600">
                    de <span className="text-slate-500">&ldquo;{e.antes}&rdquo;</span> para{" "}
                    <span className="text-slate-800">&ldquo;{e.depois}&rdquo;</span>
                  </p>
                )}
                {e.detalhe && <p className="mt-0.5 text-slate-600">{e.detalhe}</p>}
                <p className="mt-0.5 text-xs text-slate-400">
                  {formatData(e.data)} · {usuario ? usuario.nome : e.semUsuario}
                </p>
              </li>
            );
          })}
          {eventos.length === 0 && (
            <p className="text-sm text-slate-400">Nenhum registro ainda.</p>
          )}
        </ol>
      </div>
    </div>
  );
}
