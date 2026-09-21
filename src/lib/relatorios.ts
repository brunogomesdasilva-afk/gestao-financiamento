import type { createClient } from "@/lib/supabase/server";
import { buscarTodos } from "@/lib/paginacao";
import type {
  Cliente,
  Empreendimento,
  Etapa,
  ModalidadeFinanciamento,
  StatusUnidadeConfig,
  Torre,
  Unidade,
} from "@/lib/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Situacao = "carteira" | "todas";

export type FiltrosRelatorio = {
  empreendimento: string;
  bloco: string;
  unidade: string;
  analista: string;
  status: string;
  situacao: Situacao;
};

export function lerFiltros(origem: Record<string, string | undefined>): FiltrosRelatorio {
  return {
    empreendimento: origem.empreendimento ?? "",
    bloco: origem.bloco ?? "",
    unidade: origem.unidade ?? "",
    analista: origem.analista ?? "",
    status: origem.status ?? "",
    situacao: origem.situacao === "todas" ? "todas" : "carteira",
  };
}

export function filtrosParaParams(f: FiltrosRelatorio): URLSearchParams {
  const params = new URLSearchParams();
  if (f.empreendimento) params.set("empreendimento", f.empreendimento);
  if (f.bloco) params.set("bloco", f.bloco);
  if (f.unidade) params.set("unidade", f.unidade);
  if (f.analista) params.set("analista", f.analista);
  if (f.status) params.set("status", f.status);
  if (f.situacao !== "carteira") params.set("situacao", f.situacao);
  return params;
}

// ---------- Relatório consolidado ----------

export type LinhaConsolidado = {
  clienteId: string;
  empreendimentoId: string;
  empreendimento: string;
  bloco: string;
  unidade: string;
  etapaId: string;
  etapaOrdem: number;
  status: string;
  analistaId: string;
  analista: string;
  proprietario: string;
  cpf: string;
  telefone: string;
  email: string;
  banco: string;
  agencia: string;
  modalidade: string;
  validade: string | null;
  financiamentoContratado: number | null;
  valorAprovado: number | null;
  diferenca: number | null;
  fgtsContratado: number | null;
  fgtsAtualizacao: number | null;
  terreno: number | null;
  seguro: number | null;
  escritura: number | null;
  situacao: "Em carteira" | "Encerrada";
  assumidaEm: string;
  atualizadoEm: string;
  observacoes: string;
};

// Uma linha por unidade, com a última informação cadastrada. Se a unidade já passou por mais de um
// acompanhamento (devolvida e assumida de novo), vale o mais recente.
export async function carregarConsolidado(supabase: Supabase, situacao: Situacao): Promise<LinhaConsolidado[]> {
  const [clientes, unidades, { data: torres }, { data: empreendimentos }, { data: etapas }, { data: perfis }, { data: modalidades }] =
    await Promise.all([
      buscarTodos<Cliente>((de, ate) => {
        let consulta = supabase.from("clientes").select("*").order("id").range(de, ate);
        if (situacao === "carteira") consulta = consulta.eq("arquivado", false);
        return consulta;
      }),
      buscarTodos<Pick<Unidade, "id" | "torre_id" | "numero">>((de, ate) =>
        supabase.from("unidades").select("id, torre_id, numero").order("id").range(de, ate)
      ),
      supabase.from("torres").select("*"),
      supabase.from("empreendimentos").select("*"),
      supabase.from("etapas").select("*"),
      supabase.from("profiles").select("id, nome"),
      supabase.from("modalidades_financiamento").select("*"),
    ]);

  const unidadePorId = new Map(unidades.map((u) => [u.id, u]));
  const torrePorId = new Map(((torres ?? []) as Torre[]).map((t) => [t.id, t]));
  const empreendimentoPorId = new Map(((empreendimentos ?? []) as Empreendimento[]).map((e) => [e.id, e]));
  const etapaPorId = new Map(((etapas ?? []) as Etapa[]).map((e) => [e.id, e]));
  const analistaPorId = new Map(((perfis ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]));
  const modalidadePorId = new Map(((modalidades ?? []) as ModalidadeFinanciamento[]).map((m) => [m.id, m.nome]));

  const maisRecentePorUnidade = new Map<string, Cliente>();
  const semUnidade: Cliente[] = [];
  for (const c of clientes) {
    if (!c.unidade_id) {
      semUnidade.push(c);
      continue;
    }
    const atual = maisRecentePorUnidade.get(c.unidade_id);
    if (!atual || c.created_at > atual.created_at) maisRecentePorUnidade.set(c.unidade_id, c);
  }

  const linhas = [...maisRecentePorUnidade.values(), ...semUnidade].map((c): LinhaConsolidado => {
    const unidade = c.unidade_id ? unidadePorId.get(c.unidade_id) : undefined;
    const torre = unidade ? torrePorId.get(unidade.torre_id) : undefined;
    const etapa = c.etapa_atual_id ? etapaPorId.get(c.etapa_atual_id) : undefined;
    return {
      clienteId: c.id,
      empreendimentoId: c.empreendimento_id ?? "",
      empreendimento: (c.empreendimento_id ? empreendimentoPorId.get(c.empreendimento_id)?.nome : undefined) ?? "—",
      bloco: torre?.nome ?? "—",
      unidade: unidade?.numero ?? "—",
      etapaId: c.etapa_atual_id ?? "",
      etapaOrdem: etapa?.ordem ?? 0,
      status: etapa?.nome ?? "—",
      analistaId: c.analista_responsavel_id ?? "",
      analista: (c.analista_responsavel_id ? analistaPorId.get(c.analista_responsavel_id) : undefined) ?? "—",
      proprietario: c.nome ?? "",
      cpf: c.cpf ?? "",
      telefone: c.telefone ?? "",
      email: c.email ?? "",
      banco: c.banco_financiador ?? "",
      agencia: c.agencia_financiamento ?? "",
      modalidade: (c.modalidade_financiamento_id ? modalidadePorId.get(c.modalidade_financiamento_id) : undefined) ?? "",
      validade: c.validade,
      financiamentoContratado: c.financiamento_contratado,
      valorAprovado: c.valor_aprovado,
      diferenca: c.diferenca_aprovacao_contratado,
      fgtsContratado: c.fgts_contratado,
      fgtsAtualizacao: c.fgts_atualizacao,
      terreno: c.terreno,
      seguro: c.seguro,
      escritura: c.escritura,
      situacao: c.arquivado ? "Encerrada" : "Em carteira",
      assumidaEm: c.created_at,
      atualizadoEm: c.updated_at,
      observacoes: c.observacoes ?? "",
    };
  });

  return linhas.sort(
    (a, b) =>
      a.empreendimento.localeCompare(b.empreendimento, "pt-BR") ||
      a.bloco.localeCompare(b.bloco, "pt-BR", { numeric: true }) ||
      a.unidade.localeCompare(b.unidade, "pt-BR", { numeric: true })
  );
}

export function filtrarConsolidado(linhas: LinhaConsolidado[], f: FiltrosRelatorio): LinhaConsolidado[] {
  return linhas.filter(
    (l) =>
      (!f.empreendimento || l.empreendimentoId === f.empreendimento) &&
      (!f.bloco || l.bloco === f.bloco) &&
      (!f.unidade || l.unidade === f.unidade) &&
      (!f.analista || l.analistaId === f.analista) &&
      (!f.status || l.etapaId === f.status)
  );
}

// ---------- Dash por empreendimento ----------

export type ContagemStatus = { nome: string; cor: string; qtd: number };

export type DashEmpreendimento = {
  id: string;
  nome: string;
  totalUnidades: number;
  unidadesPorStatus: ContagemStatus[]; // status da unidade no espelho de vendas
  emAnalise: number;
  analisePorEtapa: ContagemStatus[]; // status da esteira de análise de financiamento
};

export async function carregarDash(supabase: Supabase): Promise<DashEmpreendimento[]> {
  const [{ data: empreendimentos }, { data: torres }, unidades, clientes, { data: etapas }, { data: statusUnidade }] =
    await Promise.all([
      supabase.from("empreendimentos").select("*").order("nome"),
      supabase.from("torres").select("id, empreendimento_id"),
      buscarTodos<Pick<Unidade, "status" | "torre_id">>((de, ate) =>
        supabase.from("unidades").select("id, status, torre_id").order("id").range(de, ate)
      ),
      buscarTodos<Pick<Cliente, "empreendimento_id" | "etapa_atual_id">>((de, ate) =>
        supabase
          .from("clientes")
          .select("id, empreendimento_id, etapa_atual_id")
          .eq("arquivado", false)
          .order("id")
          .range(de, ate)
      ),
      supabase.from("etapas").select("*").order("ordem", { ascending: true }),
      supabase.from("status_unidade").select("*").order("ordem"),
    ]);

  const empreendimentoDaTorre = new Map(
    ((torres ?? []) as { id: string; empreendimento_id: string }[]).map((t) => [t.id, t.empreendimento_id])
  );
  const etapasLista = (etapas ?? []) as Etapa[];
  const statusLista = (statusUnidade ?? []) as StatusUnidadeConfig[];

  return ((empreendimentos ?? []) as Empreendimento[]).map((e) => {
    const porStatus = new Map<string, number>();
    let totalUnidades = 0;
    for (const u of unidades) {
      if (empreendimentoDaTorre.get(u.torre_id) !== e.id) continue;
      totalUnidades++;
      porStatus.set(u.status, (porStatus.get(u.status) ?? 0) + 1);
    }

    const porEtapa = new Map<string, number>();
    let emAnalise = 0;
    for (const c of clientes) {
      if (c.empreendimento_id !== e.id) continue;
      emAnalise++;
      if (c.etapa_atual_id) porEtapa.set(c.etapa_atual_id, (porEtapa.get(c.etapa_atual_id) ?? 0) + 1);
    }

    return {
      id: e.id,
      nome: e.nome,
      totalUnidades,
      unidadesPorStatus: statusLista
        .map((s) => ({ nome: s.nome, cor: s.cor, qtd: porStatus.get(s.nome) ?? 0 }))
        .filter((s) => s.qtd > 0 || s.nome !== "Não informado"),
      emAnalise,
      analisePorEtapa: etapasLista.map((et) => ({ nome: et.nome, cor: et.cor, qtd: porEtapa.get(et.id) ?? 0 })),
    };
  });
}

// ---------- Relatório de meta ----------

export type MetaAnalista = { id: string; nome: string; porEtapa: Map<string, number>; total: number };
export type MetaEmpreendimento = { id: string; nome: string; analistas: MetaAnalista[] };

export async function carregarMeta(
  supabase: Supabase,
  situacao: Situacao
): Promise<{ empreendimentos: MetaEmpreendimento[]; etapas: Etapa[] }> {
  const [{ data: empreendimentos }, { data: etapas }, { data: perfis }, clientes] = await Promise.all([
    supabase.from("empreendimentos").select("*").order("nome"),
    supabase.from("etapas").select("*").order("ordem", { ascending: true }),
    supabase.from("profiles").select("id, nome"),
    buscarTodos<Pick<Cliente, "empreendimento_id" | "analista_responsavel_id" | "etapa_atual_id">>((de, ate) => {
      let consulta = supabase
        .from("clientes")
        .select("id, empreendimento_id, analista_responsavel_id, etapa_atual_id")
        .order("id")
        .range(de, ate);
      if (situacao === "carteira") consulta = consulta.eq("arquivado", false);
      return consulta;
    }),
  ]);

  const nomeAnalista = new Map(((perfis ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]));

  const resultado = ((empreendimentos ?? []) as Empreendimento[])
    .map((e) => {
      const porAnalista = new Map<string, MetaAnalista>();
      for (const c of clientes) {
        if (c.empreendimento_id !== e.id || !c.analista_responsavel_id) continue;
        let a = porAnalista.get(c.analista_responsavel_id);
        if (!a) {
          a = {
            id: c.analista_responsavel_id,
            nome: nomeAnalista.get(c.analista_responsavel_id) ?? "—",
            porEtapa: new Map(),
            total: 0,
          };
          porAnalista.set(a.id, a);
        }
        a.total++;
        if (c.etapa_atual_id) a.porEtapa.set(c.etapa_atual_id, (a.porEtapa.get(c.etapa_atual_id) ?? 0) + 1);
      }
      return {
        id: e.id,
        nome: e.nome,
        analistas: Array.from(porAnalista.values()).sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")),
      };
    })
    .filter((e) => e.analistas.length > 0);

  return { empreendimentos: resultado, etapas: (etapas ?? []) as Etapa[] };
}
