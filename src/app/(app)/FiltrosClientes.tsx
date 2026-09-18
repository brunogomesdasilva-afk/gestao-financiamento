"use client";

import { useRouter } from "next/navigation";
import type { Empreendimento, Etapa } from "@/lib/database.types";

export function FiltrosClientes({
  empreendimentos,
  etapas,
  analistas,
  empreendimentoSelecionado,
  etapaSelecionada,
  analistaSelecionado,
}: {
  empreendimentos: Empreendimento[];
  etapas: Etapa[];
  analistas?: { id: string; nome: string }[];
  empreendimentoSelecionado: string;
  etapaSelecionada: string;
  analistaSelecionado: string;
}) {
  const router = useRouter();

  function atualizarFiltro(campo: "empreendimento" | "etapa" | "analista", valor: string) {
    const params = new URLSearchParams(window.location.search);
    if (valor) params.set(campo, valor);
    else params.delete(campo);
    router.push(`/?${params.toString()}`);
  }

  const temFiltro = Boolean(empreendimentoSelecionado || etapaSelecionada || analistaSelecionado);

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-medium text-slate-700">Empreendimento</label>
        <select
          value={empreendimentoSelecionado}
          onChange={(e) => atualizarFiltro("empreendimento", e.target.value)}
          className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Todos</option>
          {empreendimentos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">Status</label>
        <select
          value={etapaSelecionada}
          onChange={(e) => atualizarFiltro("etapa", e.target.value)}
          className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Todos</option>
          {etapas.map((etapa) => (
            <option key={etapa.id} value={etapa.id}>
              {etapa.nome}
            </option>
          ))}
        </select>
      </div>
      {analistas && (
        <div>
          <label className="block text-xs font-medium text-slate-700">Analista</label>
          <select
            value={analistaSelecionado}
            onChange={(e) => atualizarFiltro("analista", e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {analistas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
      )}
      {temFiltro && (
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-xs text-slate-500 underline hover:text-slate-900"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
