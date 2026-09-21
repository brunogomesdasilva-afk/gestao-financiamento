import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatarValorHistorico } from "@/lib/historico";
import {
  CAMPO_LABEL,
  type AndamentoHistorico,
  type Cliente,
  type Empreendimento,
  type Etapa,
  type HistoricoAlteracao,
  type ModalidadeFinanciamento,
  type Profile,
  type Torre,
  type Unidade,
} from "@/lib/database.types";
import { arquivarCliente } from "../actions";

function formatMoeda(valor: number | null) {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDataCurta(data: string | null) {
  if (!data) return "—";
  return new Date(data).toLocaleDateString("pt-BR", { dateStyle: "short" });
}

// Registros automáticos do sistema que não precisam repetir a observação na linha do tempo.
const OBSERVACAO_AUTOMATICA_STATUS = "Status alterado na edição do cadastro";

type GrupoHistorico = {
  chave: string;
  dia: string;
  usuarioId: string | null;
  ultimaData: string;
  itens: EventoHistorico[];
};

type EventoHistorico = {
  chave: string;
  data: string;
  usuarioId: string | null;
  campo?: string; // quando é a troca de um campo: "O campo X foi alterado de A para B"
  antes?: string;
  depois?: string;
  texto?: string; // quando é uma ação: "Unidade assumida pelo analista"
  detalhe?: string | null;
};

export default async function ClienteDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const supabase = await createClient();

  const [
    { data: cliente },
    { data: etapas },
    { data: andamento },
    { data: usuarios },
    { data: modalidades },
    { data: alteracoes },
  ] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase.from("etapas").select("*").order("ordem", { ascending: true }),
    supabase.from("andamento_historico").select("*").eq("cliente_id", id),
    supabase.from("profiles").select("*"),
    supabase.from("modalidades_financiamento").select("*"),
    supabase.from("historico_alteracoes").select("*").eq("cliente_id", id),
  ]);

  if (!cliente) notFound();

  const clienteTyped = cliente as Cliente;

  let empreendimento: Empreendimento | null = null;
  if (clienteTyped.empreendimento_id) {
    const { data } = await supabase
      .from("empreendimentos")
      .select("*")
      .eq("id", clienteTyped.empreendimento_id)
      .single();
    empreendimento = data;
  }

  let unidade: Unidade | null = null;
  let torre: Torre | null = null;
  if (clienteTyped.unidade_id) {
    const { data } = await supabase.from("unidades").select("*").eq("id", clienteTyped.unidade_id).single();
    unidade = data;
    if (unidade) {
      const { data: torreData } = await supabase
        .from("torres")
        .select("*")
        .eq("id", unidade.torre_id)
        .single();
      torre = torreData;
    }
  }

  const etapasTyped = (etapas ?? []) as Etapa[];
  const etapaAtual = etapasTyped.find((e) => e.id === clienteTyped.etapa_atual_id);
  const etapaPorId = new Map(etapasTyped.map((e) => [e.id, e]));
  const usuariosPorId = new Map<string, Profile>((usuarios ?? []).map((u: Profile) => [u.id, u]));
  const modalidadesPorId = new Map<string, ModalidadeFinanciamento>(
    ((modalidades ?? []) as ModalidadeFinanciamento[]).map((m) => [m.id, m])
  );
  const contexto = {
    modalidadePorId: new Map(Array.from(modalidadesPorId.values()).map((m) => [m.id, m.nome])),
    usuarioPorId: usuariosPorId,
  };

  // Histórico único: trocas de status, ações (assumida, devolvida...) e alterações de campos,
  // da mais recente para a mais antiga.
  const eventos: EventoHistorico[] = [];

  let etapaAnteriorId: string | null = null;
  const andamentoCronologico = [...((andamento ?? []) as AndamentoHistorico[])].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
  for (const a of andamentoCronologico) {
    const mudouStatus = Boolean(a.etapa_id && etapaAnteriorId && a.etapa_id !== etapaAnteriorId);
    if (mudouStatus) {
      eventos.push({
        chave: `a-${a.id}`,
        data: a.created_at,
        usuarioId: a.usuario_id,
        campo: "Status",
        antes: etapaPorId.get(etapaAnteriorId ?? "")?.nome ?? "—",
        depois: etapaPorId.get(a.etapa_id ?? "")?.nome ?? "—",
        detalhe: a.observacao && a.observacao !== OBSERVACAO_AUTOMATICA_STATUS ? a.observacao : null,
      });
    } else {
      const status = etapaPorId.get(a.etapa_id ?? "")?.nome;
      eventos.push({
        chave: `a-${a.id}`,
        data: a.created_at,
        usuarioId: a.usuario_id,
        texto: a.observacao ?? "Andamento registrado",
        detalhe: status ? `Status: ${status}` : null,
      });
    }
    if (a.etapa_id) etapaAnteriorId = a.etapa_id;
  }

  for (const c of (alteracoes ?? []) as HistoricoAlteracao[]) {
    eventos.push({
      chave: `c-${c.id}`,
      data: c.created_at,
      usuarioId: c.usuario_id,
      campo: CAMPO_LABEL[c.campo] ?? c.campo,
      antes: formatarValorHistorico(c.campo, c.valor_anterior, contexto),
      depois: formatarValorHistorico(c.campo, c.valor_novo, contexto),
    });
  }

  // O que um mesmo analista fez no mesmo dia vira um bloco só, com um texto único.
  // Os blocos ficam do mais recente para o mais antigo; dentro do bloco, na ordem em que aconteceu.
  const grupos = new Map<string, GrupoHistorico>();
  for (const e of [...eventos].sort((x, y) => x.data.localeCompare(y.data))) {
    const dia = new Date(e.data).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const chave = `${dia}|${e.usuarioId ?? "sistema"}`;
    const grupo = grupos.get(chave);
    if (grupo) {
      grupo.itens.push(e);
      grupo.ultimaData = e.data;
    } else {
      grupos.set(chave, { chave, dia, usuarioId: e.usuarioId, ultimaData: e.data, itens: [e] });
    }
  }
  const gruposOrdenados = Array.from(grupos.values()).sort((a, b) => b.ultimaData.localeCompare(a.ultimaData));

  const arquivarComId = arquivarCliente.bind(null, id, !clienteTyped.arquivado);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{clienteTyped.nome ?? "Proprietário não informado"}</h1>
            {empreendimento && (
              <p className="text-sm text-slate-500">
                {empreendimento.nome}
                {torre ? ` · ${torre.nome}` : ""}
                {unidade ? ` · Unidade ${unidade.numero}` : ""}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link
              href={`/clientes/${id}/editar`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Editar
            </Link>
            <form action={arquivarComId}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {clienteTyped.arquivado ? "Reativar" : "Concluir e liberar unidade"}
              </button>
            </form>
          </div>
        </div>

        {etapaAtual && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: etapaAtual.cor }} />
            <span className="text-xs font-medium text-slate-700">{etapaAtual.nome}</span>
          </div>
        )}

        <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">Dados pessoais</h2>
        <dl className="mt-2 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-400">CPF</dt>
            <dd className="text-slate-900">{clienteTyped.cpf ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Telefone</dt>
            <dd className="text-slate-900">{clienteTyped.telefone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">E-mail</dt>
            <dd className="text-slate-900">{clienteTyped.email ?? "—"}</dd>
          </div>
        </dl>

        <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">Financiamento</h2>
        <dl className="mt-2 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-400">Banco financiador</dt>
            <dd className="text-slate-900">{clienteTyped.banco_financiador ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Agência</dt>
            <dd className="text-slate-900">{clienteTyped.agencia_financiamento ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Modalidade</dt>
            <dd className="text-slate-900">
              {clienteTyped.modalidade_financiamento_id
                ? modalidadesPorId.get(clienteTyped.modalidade_financiamento_id)?.nome ?? "—"
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Validade da aprovação</dt>
            <dd className="text-slate-900">{formatDataCurta(clienteTyped.validade)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Valor de compra e venda</dt>
            <dd className="text-slate-900">{formatMoeda(clienteTyped.valor_compra)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Financiamento contratado</dt>
            <dd className="text-slate-900">{formatMoeda(clienteTyped.financiamento_contratado)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Valor aprovado</dt>
            <dd className="text-slate-900">{formatMoeda(clienteTyped.valor_aprovado)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Diferença (aprovado − contratado)</dt>
            <dd className="text-slate-900">{formatMoeda(clienteTyped.diferenca_aprovacao_contratado)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">FGTS contratado</dt>
            <dd className="text-slate-900">{formatMoeda(clienteTyped.fgts_contratado)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">FGTS atualização</dt>
            <dd className="text-slate-900">{formatMoeda(clienteTyped.fgts_atualizacao)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Terreno</dt>
            <dd className="text-slate-900">{formatMoeda(clienteTyped.terreno)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Seguro</dt>
            <dd className="text-slate-900">{formatMoeda(clienteTyped.seguro)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Escritura</dt>
            <dd className="text-slate-900">{formatMoeda(clienteTyped.escritura)}</dd>
          </div>
        </dl>

        <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">Responsável</h2>
        <dl className="mt-2 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-400">Analista responsável</dt>
            <dd className="text-slate-900">
              {clienteTyped.analista_responsavel_id
                ? usuariosPorId.get(clienteTyped.analista_responsavel_id)?.nome ?? "—"
                : "—"}
            </dd>
          </div>
        </dl>

        {clienteTyped.observacoes && (
          <div className="mt-6">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Observações</dt>
            <dd className="mt-1 text-sm text-slate-700">{clienteTyped.observacoes}</dd>
          </div>
        )}
      </div>

      <div id="historico" className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Histórico de alterações</h2>
        <p className="mt-1 text-xs text-slate-400">Da mais recente para a mais antiga.</p>
        <ol className="mt-4 space-y-4">
          {gruposOrdenados.map((g) => {
            const usuario = g.usuarioId ? usuariosPorId.get(g.usuarioId) : null;
            return (
              <li key={g.chave} className="overflow-hidden rounded-lg border border-slate-200 text-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2">
                  <span className="font-medium text-slate-900">
                    Analista: {usuario ? usuario.nome : "Sistema"}
                  </span>
                  <span className="text-xs text-slate-500">{g.dia}</span>
                </div>
                <p className="px-4 py-3 leading-relaxed text-slate-700">
                  {g.itens.map((e) => (
                    <span key={e.chave}>
                      {e.campo ? (
                        <>
                          O campo <span className="font-medium text-slate-900">{e.campo}</span> foi alterado de{" "}
                          <span className="text-slate-500">&ldquo;{e.antes}&rdquo;</span> para{" "}
                          <span className="font-medium text-slate-900">&ldquo;{e.depois}&rdquo;</span>
                        </>
                      ) : (
                        <span className="font-medium text-slate-900">{e.texto}</span>
                      )}
                      {e.detalhe ? ` (${e.detalhe})` : ""}.{" "}
                    </span>
                  ))}
                </p>
              </li>
            );
          })}
          {gruposOrdenados.length === 0 && <p className="text-sm text-slate-400">Nenhum registro ainda.</p>}
        </ol>
      </div>
    </div>
  );
}
