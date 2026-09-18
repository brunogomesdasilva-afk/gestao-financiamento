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

export type SelecaoCarteira = {
  empreendimento: string;
  bloco: string;
  unidade: string;
  status: string;
};

const SELECT = "mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm";

function unicos<T>(itens: T[], chave: (i: T) => string): T[] {
  const vistos = new Set<string>();
  return itens.filter((i) => {
    const k = chave(i);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

// Filtros da carteira. As opções vêm só das unidades que o analista tem e se ajustam em cascata:
// escolher um empreendimento reduz os blocos, e escolher um bloco reduz as unidades.
export function FiltrosCarteira({
  linhas,
  selecao,
}: {
  linhas: LinhaFiltro[];
  selecao: SelecaoCarteira;
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

  function aplicar(nova: SelecaoCarteira) {
    const params = new URLSearchParams();
    if (nova.empreendimento) params.set("empreendimento", nova.empreendimento);
    if (nova.bloco) params.set("bloco", nova.bloco);
    if (nova.unidade) params.set("unidade", nova.unidade);
    if (nova.status) params.set("status", nova.status);
    const consulta = params.toString();
    router.push(consulta ? `/clientes?${consulta}` : "/clientes");
  }

  const temFiltro = Boolean(selecao.empreendimento || selecao.bloco || selecao.unidade || selecao.status);

  return (
    <div className="mt-6 flex flex-wrap items-end gap-3">
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
        <label className="block text-xs font-medium text-slate-700">Bloco</label>
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
      {temFiltro && (
        <button
          type="button"
          onClick={() => router.push("/clientes")}
          className="text-xs text-slate-500 underline hover:text-slate-900"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
