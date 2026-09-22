import type { createClient } from "@/lib/supabase/server";
import { buscarTodos } from "@/lib/paginacao";
import type {
  AndamentoHistorico,
  Cliente,
  Empreendimento,
  Etapa,
  ModalidadeFinanciamento,
  StatusUnidadeConfig,
  Torre,
  Unidade,
} from "@/lib/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Ano e mês (1-12) de uma data no fuso de São Paulo, para filtros "neste mês" consistentes com o
// resto do sistema (que sempre mostra datas nesse fuso).
export function anoMesSaoPaulo(dataIso: string): { ano: number; mes: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(dataIso));
  return {
    ano: Number(partes.find((p) => p.type === "year")?.value),
    mes: Number(partes.find((p) => p.type === "month")?.value),
  };
}

// Dias corridos (calendário, no fuso de São Paulo) entre uma data e hoje — ignora o horário, só a
// data conta, para bater com "está nesse status há N dias" como qualquer pessoa contaria no calendário.
export function diasCorridosDesde(dataIso: string): number {
  const soData = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
  const hoje = new Date(`${soData(new Date())}T00:00:00`);
  const data = new Date(`${soData(new Date(dataIso))}T00:00:00`);
  return Math.round((hoje.getTime() - data.getTime()) / 86_400_000);
}

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
  valorCompra: number | null;
  financiamentoContratado: number | null;
  valorAprovado: number | null;
  diferenca: number | null;
  fgtsContratado: number | null;
  fgtsAtualizacao: number | null;
  terreno: number | null;
  seguro: string | null;
  escritura: string | null;
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
      valorCompra: c.valor_compra ?? null,
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

export function filtrarConsolidado<T extends LinhaConsolidado>(linhas: T[], f: FiltrosRelatorio): T[] {
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

export type PeriodoRelatorio = { ano: number; mes: number };

export async function carregarDash(supabase: Supabase, periodo?: PeriodoRelatorio): Promise<DashEmpreendimento[]> {
  const [{ data: empreendimentos }, { data: torres }, unidades, clientes, { data: etapas }, { data: statusUnidade }, andamento] =
    await Promise.all([
      supabase.from("empreendimentos").select("*").order("nome"),
      supabase.from("torres").select("id, empreendimento_id"),
      buscarTodos<Pick<Unidade, "status" | "torre_id">>((de, ate) =>
        supabase.from("unidades").select("id, status, torre_id").order("id").range(de, ate)
      ),
      buscarTodos<Pick<Cliente, "id" | "empreendimento_id" | "etapa_atual_id">>((de, ate) =>
        supabase
          .from("clientes")
          .select("id, empreendimento_id, etapa_atual_id")
          .eq("arquivado", false)
          .order("id")
          .range(de, ate)
      ),
      supabase.from("etapas").select("*").order("ordem", { ascending: true }),
      supabase.from("status_unidade").select("*").order("ordem"),
      // Só busca o andamento completo quando há filtro de período (senão a contagem é sempre a atual).
      periodo
        ? buscarTodos<Pick<AndamentoHistorico, "cliente_id" | "etapa_id" | "created_at">>((de, ate) =>
            supabase.from("andamento_historico").select("cliente_id, etapa_id, created_at").order("id").range(de, ate)
          )
        : Promise.resolve([] as Pick<AndamentoHistorico, "cliente_id" | "etapa_id" | "created_at">[]),
    ]);

  const empreendimentoDaTorre = new Map(
    ((torres ?? []) as { id: string; empreendimento_id: string }[]).map((t) => [t.id, t.empreendimento_id])
  );
  const etapasLista = (etapas ?? []) as Etapa[];
  const statusLista = (statusUnidade ?? []) as StatusUnidadeConfig[];

  // Data em que cada cliente entrou na etapa que é hoje a etapa atual dele (a transição mais recente
  // para essa etapa específica). Usada só quando um período foi escolhido.
  let entradaNaEtapaAtual: Map<string, string> | null = null;
  if (periodo) {
    const etapaAtualPorCliente = new Map(clientes.map((c) => [c.id, c.etapa_atual_id]));
    entradaNaEtapaAtual = new Map();
    for (const a of andamento) {
      if (!a.etapa_id || a.etapa_id !== etapaAtualPorCliente.get(a.cliente_id)) continue;
      const atual = entradaNaEtapaAtual.get(a.cliente_id);
      if (!atual || a.created_at > atual) entradaNaEtapaAtual.set(a.cliente_id, a.created_at);
    }
  }

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
      if (periodo) {
        const dataEntrada = entradaNaEtapaAtual?.get(c.id);
        if (!dataEntrada) continue;
        const { ano, mes } = anoMesSaoPaulo(dataEntrada);
        if (ano !== periodo.ano || mes !== periodo.mes) continue;
      }
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
// A meta é o número de unidades que cada analista repassou (status REPASSADO) dentro do mês
// escolhido — contando a data em que a unidade entrou nesse status, não a data de hoje.

export type UnidadeRepassada = {
  clienteId: string;
  empreendimento: string;
  bloco: string;
  unidade: string;
  proprietario: string;
  repassadoEm: string;
};

export type MetaAnalista = { id: string; nome: string; unidades: UnidadeRepassada[] };
export type MetaEmpreendimento = { id: string; nome: string; analistas: MetaAnalista[]; total: number };

export async function carregarMetaRepassados(
  supabase: Supabase,
  periodo: PeriodoRelatorio
): Promise<{ empreendimentos: MetaEmpreendimento[]; totalGeral: number }> {
  const { data: etapaRepassado } = await supabase.from("etapas").select("id").eq("nome", "REPASSADO").maybeSingle();
  if (!etapaRepassado) return { empreendimentos: [], totalGeral: 0 };

  const [clientes, { data: perfis }, andamento] = await Promise.all([
    buscarTodos<Cliente>((de, ate) =>
      supabase.from("clientes").select("*").eq("etapa_atual_id", etapaRepassado.id).order("id").range(de, ate)
    ),
    supabase.from("profiles").select("id, nome"),
    buscarTodos<Pick<AndamentoHistorico, "cliente_id" | "created_at">>((de, ate) =>
      supabase
        .from("andamento_historico")
        .select("cliente_id, created_at")
        .eq("etapa_id", etapaRepassado.id)
        .order("id")
        .range(de, ate)
    ),
  ]);

  // A transição mais recente para REPASSADO de cada cliente (se ele voltou a ficar REPASSADO depois
  // de sair e retornar, vale a última vez).
  const repassadoEmPorCliente = new Map<string, string>();
  for (const a of andamento) {
    const atual = repassadoEmPorCliente.get(a.cliente_id);
    if (!atual || a.created_at > atual) repassadoEmPorCliente.set(a.cliente_id, a.created_at);
  }

  const clientesNoPeriodo = clientes.filter((c) => {
    const data = repassadoEmPorCliente.get(c.id);
    if (!data) return false;
    const { ano, mes } = anoMesSaoPaulo(data);
    return ano === periodo.ano && mes === periodo.mes;
  });

  const unidadeIds = clientesNoPeriodo.map((c) => c.unidade_id).filter((id): id is string => Boolean(id));
  const { data: unidadesData } = unidadeIds.length
    ? await supabase.from("unidades").select("id, numero, torre_id").in("id", unidadeIds)
    : { data: [] };
  const unidades = (unidadesData ?? []) as Pick<Unidade, "id" | "numero" | "torre_id">[];
  const torreIds = Array.from(new Set(unidades.map((u) => u.torre_id)));
  const [{ data: torresData }, { data: empreendimentosData }] = await Promise.all([
    torreIds.length ? supabase.from("torres").select("*").in("id", torreIds) : Promise.resolve({ data: [] }),
    supabase.from("empreendimentos").select("*"),
  ]);

  const unidadePorId = new Map(unidades.map((u) => [u.id, u]));
  const torrePorId = new Map(((torresData ?? []) as Torre[]).map((t) => [t.id, t]));
  const empPorId = new Map(((empreendimentosData ?? []) as Empreendimento[]).map((e) => [e.id, e]));
  const nomeAnalista = new Map(((perfis ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]));

  const porEmpreendimento = new Map<string, MetaEmpreendimento>();
  let totalGeral = 0;
  for (const c of clientesNoPeriodo) {
    if (!c.empreendimento_id || !c.analista_responsavel_id) continue;
    const unidade = c.unidade_id ? unidadePorId.get(c.unidade_id) : undefined;
    const torre = unidade ? torrePorId.get(unidade.torre_id) : undefined;

    let emp = porEmpreendimento.get(c.empreendimento_id);
    if (!emp) {
      emp = { id: c.empreendimento_id, nome: empPorId.get(c.empreendimento_id)?.nome ?? "—", analistas: [], total: 0 };
      porEmpreendimento.set(c.empreendimento_id, emp);
    }
    let analista = emp.analistas.find((a) => a.id === c.analista_responsavel_id);
    if (!analista) {
      analista = { id: c.analista_responsavel_id, nome: nomeAnalista.get(c.analista_responsavel_id) ?? "—", unidades: [] };
      emp.analistas.push(analista);
    }
    analista.unidades.push({
      clienteId: c.id,
      empreendimento: emp.nome,
      bloco: torre?.nome ?? "—",
      unidade: unidade?.numero ?? "—",
      proprietario: c.nome ?? "Proprietário não informado",
      repassadoEm: repassadoEmPorCliente.get(c.id) ?? c.updated_at,
    });
    emp.total++;
    totalGeral++;
  }

  const empreendimentos = Array.from(porEmpreendimento.values())
    .map((e) => ({ ...e, analistas: e.analistas.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return { empreendimentos, totalGeral };
}

// ---------- Relatório de tempo no status ----------
// Unidades em carteira cujo status (etapa) não muda há mais de N dias — mesmos campos e filtros da
// tela "Minhas unidades", com a data e os dias desde a última troca de status.

export type LinhaTempoNoStatus = LinhaConsolidado & {
  statusDesde: string;
  diasNoStatus: number;
};

export async function carregarTempoNoStatus(supabase: Supabase, diasMinimo: number): Promise<LinhaTempoNoStatus[]> {
  const [clientes, unidades, { data: torres }, { data: empreendimentos }, { data: etapas }, { data: perfis }, andamento] =
    await Promise.all([
      buscarTodos<Cliente>((de, ate) =>
        supabase.from("clientes").select("*").eq("arquivado", false).order("id").range(de, ate)
      ),
      buscarTodos<Pick<Unidade, "id" | "torre_id" | "numero">>((de, ate) =>
        supabase.from("unidades").select("id, torre_id, numero").order("id").range(de, ate)
      ),
      supabase.from("torres").select("*"),
      supabase.from("empreendimentos").select("*"),
      supabase.from("etapas").select("*"),
      supabase.from("profiles").select("id, nome"),
      buscarTodos<Pick<AndamentoHistorico, "cliente_id" | "etapa_id" | "created_at">>((de, ate) =>
        supabase.from("andamento_historico").select("cliente_id, etapa_id, created_at").order("id").range(de, ate)
      ),
    ]);

  const unidadePorId = new Map(unidades.map((u) => [u.id, u]));
  const torrePorId = new Map(((torres ?? []) as Torre[]).map((t) => [t.id, t]));
  const empreendimentoPorId = new Map(((empreendimentos ?? []) as Empreendimento[]).map((e) => [e.id, e]));
  const etapaPorId = new Map(((etapas ?? []) as Etapa[]).map((e) => [e.id, e]));
  const analistaPorId = new Map(((perfis ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]));

  // A transição mais recente para a etapa que é hoje a etapa atual de cada cliente.
  const etapaAtualPorCliente = new Map(clientes.map((c) => [c.id, c.etapa_atual_id]));
  const entradaNaEtapaAtual = new Map<string, string>();
  for (const a of andamento) {
    if (!a.etapa_id || a.etapa_id !== etapaAtualPorCliente.get(a.cliente_id)) continue;
    const atual = entradaNaEtapaAtual.get(a.cliente_id);
    if (!atual || a.created_at > atual) entradaNaEtapaAtual.set(a.cliente_id, a.created_at);
  }

  const linhas = clientes
    .map((c): LinhaTempoNoStatus => {
      const unidade = c.unidade_id ? unidadePorId.get(c.unidade_id) : undefined;
      const torre = unidade ? torrePorId.get(unidade.torre_id) : undefined;
      const etapa = c.etapa_atual_id ? etapaPorId.get(c.etapa_atual_id) : undefined;
      const statusDesde = entradaNaEtapaAtual.get(c.id) ?? c.created_at;
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
        modalidade: "",
        validade: c.validade,
        valorCompra: c.valor_compra ?? null,
        financiamentoContratado: c.financiamento_contratado,
        valorAprovado: c.valor_aprovado,
        diferenca: c.diferenca_aprovacao_contratado,
        fgtsContratado: c.fgts_contratado,
        fgtsAtualizacao: c.fgts_atualizacao,
        terreno: c.terreno,
        seguro: c.seguro,
        escritura: c.escritura,
        situacao: "Em carteira",
        assumidaEm: c.created_at,
        atualizadoEm: c.updated_at,
        observacoes: c.observacoes ?? "",
        statusDesde,
        diasNoStatus: diasCorridosDesde(statusDesde),
      };
    })
    .filter((l) => l.diasNoStatus > diasMinimo)
    .sort((a, b) => b.diasNoStatus - a.diasNoStatus);

  return linhas;
}
