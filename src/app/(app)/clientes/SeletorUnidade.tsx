"use client";

import { useMemo, useState } from "react";
import type { Empreendimento, Torre, Unidade } from "@/lib/database.types";

export function SeletorUnidade({
  empreendimentos,
  torres,
  unidades,
}: {
  empreendimentos: Empreendimento[];
  torres: Torre[];
  unidades: Unidade[];
}) {
  const [empreendimentoId, setEmpreendimentoId] = useState("");
  const [torreId, setTorreId] = useState("");
  const [unidadeId, setUnidadeId] = useState("");

  const torresDoEmpreendimento = useMemo(
    () => torres.filter((t) => t.empreendimento_id === empreendimentoId),
    [torres, empreendimentoId]
  );

  const unidadesDaTorre = useMemo(
    () => unidades.filter((u) => u.torre_id === torreId),
    [unidades, torreId]
  );

  return (
    <div className="grid grid-cols-3 gap-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Empreendimento</label>
        <select
          value={empreendimentoId}
          onChange={(e) => {
            setEmpreendimentoId(e.target.value);
            setTorreId("");
            setUnidadeId("");
          }}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Selecione</option>
          {empreendimentos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Bloco / torre</label>
        <select
          value={torreId}
          onChange={(e) => {
            setTorreId(e.target.value);
            setUnidadeId("");
          }}
          disabled={!empreendimentoId}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
        >
          <option value="">Selecione</option>
          {torresDoEmpreendimento.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Unidade</label>
        <select
          name="unidade_id"
          required
          value={unidadeId}
          onChange={(e) => setUnidadeId(e.target.value)}
          disabled={!torreId}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
        >
          <option value="">Selecione</option>
          {unidadesDaTorre.map((u) => (
            <option key={u.id} value={u.id}>
              {u.numero}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
