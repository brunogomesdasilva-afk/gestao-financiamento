"use client";

import { useRouter } from "next/navigation";

export type LinhaFiltro = {
  empreendimentoId: string;
  empreendimento: string;
  bloco: string;
  unidade: string;
  etapaId: string;
  etapa: string;
  etapaOrdem: number;
};

export type SelecaoFiltros = {
  empreendimento: string;
  bloco: string;
  unidade: string;
  status: string;
  analista?: string;
  situacao?: string;
};

const SELECT = "mt-0.5 rounded-md border border-slate-300 px-2 py-1.5 text-sm";

function unicos<T>(itens: T[], chave: (i: T) => string): T[] {
  const vistos = new Set<string>();
  return itens.filter((i) => {
    const k = chave(i);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

// Filtros de empreendimento, bloco, unidade e status (e, opcionalmente, analista e situação).
// As opções vêm só das linhas recebidas e se ajustam em cascata: escolher um empreendimento reduz os
// blocos, e escolher um bloco reduz as unidades. A escolha vai para o endereço da página.
export function FiltrosCarteira({
  linhas,
  selecao,
  caminho = "/clientes",
  analistas,
  mostrarSituacao = false,
  valorAnalistaTodos = "",
  rotuloAnalistaTodos = "Todos",
}: {
  linhas: LinhaFiltro[];
  selecao: SelecaoFiltros;
  caminho?: string;
  analistas?: { id: string; nome: string }[];
  mostrarSituacao?: boolean;
  // Em telas onde o filtro de analista tem um padrão diferente de "todos" (ex.: "Minhas unidades",
  // que parte filtrada no usuário logado), usar um valor próprio para a opção "Todos" faz a escolha
  // ir para a URL mesmo assim, em vez de ficar indistinguível de "nenhum filtro ainda escolhido".
  valorAnalistaTodos?: string;
  rotuloAnalistaTodos?: string;
}) {
  const router = useRouter();

  const doEmpreendimento = linhas.filter(
    (l) => !selecao.empreendimento || l.empreendimentoId === selecao.empreendimento
  );
  const doBloco = doEmpreendimento.filter((l) => !selecao.bloco || l.bloco === selecao.bloco);

  const empreendimentos = unicos(linhas, (l) => l.empreendimentoId).sort((a, b) =>
    a.empreendimento.localeCompare(b.empreendimento, "pt-BR")
  );
  const blocos = unicos(doEmpreendimento, (l) => l.bloco).sort((a, b) =>
    a.bloco.localeCompare(b.bloco, "pt-BR", { numeric: true })
  );
  const unidades = unicos(doBloco, (l) => l.unidade).sort((a, b) =>
    a.unidade.localeCompare(b.unidade, "pt-BR", { numeric: true })
  );
  const statusLista = unicos(linhas, (l) => l.etapaId).sort((a, b) => a.etapaOrdem - b.etapaOrdem);

  function aplicar(nova: SelecaoFiltros) {
    const params = new URLSearchParams();
    if (nova.empreendimento) params.set("empreendimento", nova.empreendimento);
    if (nova.bloco) params.set("bloco", nova.bloco);
    if (nova.unidade) params.set("unidade", nova.unidade);
    if (nova.status) params.set("status", nova.status);
    if (nova.analista) params.set("analista", nova.analista);
    if (nova.situacao && nova.situacao !== "carteira") params.set("situacao", nova.situacao);
    const consulta = params.toString();
    router.push(consulta ? `${caminho}?${consulta}` : caminho);
  }

  const temFiltro = Boolean(
    selecao.empreendimento ||
      selecao.bloco ||
      selecao.unidade ||
      selecao.status ||
      selecao.analista ||
      (selecao.situacao && selecao.situacao !== "carteira")
  );

  return (
    <div className="mt-6 flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs font-medium text-slate-700">Empreendimento</label>
        <select
          value={selecao.empreendimento}
          onChange={(e) => aplicar({ ...selecao, empreendimento: e.target.value, bloco: "", unidade: "" })}
          className={SELECT}
        >
          <option value="">Todos</option>
          {empreendimentos.map((l) => (
            <option key={l.empreendimentoId} value={l.empreendimentoId}>
              {l.empreendimento}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">Bloco / torre</label>
        <select
          value={selecao.bloco}
          onChange={(e) => aplicar({ ...selecao, bloco: e.target.value, unidade: "" })}
          className={SELECT}
        >
          <option value="">Todos</option>
          {blocos.map((l) => (
            <option key={l.bloco} value={l.bloco}>
              {l.bloco}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">Unidade</label>
        <select
          value={selecao.unidade}
          onChange={(e) => aplicar({ ...selecao, unidade: e.target.value })}
          className={SELECT}
        >
          <option value="">Todas</option>
          {unidades.map((l) => (
            <option key={l.unidade} value={l.unidade}>
              {l.unidade}
            </option>
          ))}
        </select>
      </div>
      {analistas && (
        <div>
          <label className="block text-xs font-medium text-slate-700">Analista</label>
          <select
            value={selecao.analista ?? valorAnalistaTodos}
            onChange={(e) => aplicar({ ...selecao, analista: e.target.value })}
            className={SELECT}
          >
            <option value={valorAnalistaTodos}>{rotuloAnalistaTodos}</option>
            {analistas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-700">Status</label>
        <select
          value={selecao.status}
          onChange={(e) => aplicar({ ...selecao, status: e.target.value })}
          className={SELECT}
        >
          <option value="">Todos</option>
          {statusLista.map((l) => (
            <option key={l.etapaId} value={l.etapaId}>
              {l.etapa}
            </option>
          ))}
        </select>
      </div>
      {mostrarSituacao && (
        <div>
          <label className="block text-xs font-medium text-slate-700">Unidades</label>
          <select
            value={selecao.situacao ?? "carteira"}
            onChange={(e) => aplicar({ ...selecao, situacao: e.target.value })}
            className={SELECT}
          >
            <option value="carteira">Em carteira</option>
            <option value="todas">Todas (inclui encerradas)</option>
          </select>
        </div>
      )}
      {temFiltro && (
        <button
          type="button"
          onClick={() => router.push(caminho)}
          className="text-xs text-slate-500 underline hover:text-slate-900"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
