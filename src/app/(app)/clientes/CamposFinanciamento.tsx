"use client";

import { useState } from "react";
import type { Banco } from "@/lib/bancos";
import type { Cliente, ModalidadeFinanciamento } from "@/lib/database.types";
import { paraCampoBR, parseValorBR } from "@/lib/valores";

const CAMPO = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

function CampoValor({
  nome,
  rotulo,
  valorInicial,
  onChange,
}: {
  nome: string;
  rotulo: string;
  valorInicial: number | null | undefined;
  onChange?: (valor: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{rotulo}</label>
      <input
        name={nome}
        inputMode="decimal"
        placeholder="0,00"
        defaultValue={paraCampoBR(valorInicial)}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={CAMPO}
      />
    </div>
  );
}

// Campos do financiamento (todos opcionais), usados ao assumir a unidade e na edição do cliente.
export function CamposFinanciamento({
  modalidades,
  bancos,
  cliente,
}: {
  modalidades: ModalidadeFinanciamento[];
  bancos: Banco[];
  cliente?: Partial<Cliente>;
}) {
  const [aprovado, setAprovado] = useState(paraCampoBR(cliente?.valor_aprovado));
  const [contratado, setContratado] = useState(paraCampoBR(cliente?.financiamento_contratado));

  const diferenca = (parseValorBR(aprovado) ?? 0) - (parseValorBR(contratado) ?? 0);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Banco financiador</label>
        <input
          name="banco_financiador"
          list="bancos-brasil"
          autoComplete="off"
          placeholder="Digite para buscar"
          defaultValue={cliente?.banco_financiador ?? ""}
          className={CAMPO}
        />
        <datalist id="bancos-brasil">
          {bancos.map((b, i) => (
            <option key={`${b.codigo}-${i}`} value={b.nome} label={b.codigo != null ? String(b.codigo) : undefined} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Agência</label>
        <input name="agencia_financiamento" defaultValue={cliente?.agencia_financiamento ?? ""} className={CAMPO} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Modalidade</label>
        <select
          name="modalidade_financiamento_id"
          defaultValue={cliente?.modalidade_financiamento_id ?? ""}
          className={CAMPO}
        >
          <option value="">Selecione</option>
          {modalidades.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Validade da aprovação</label>
        <input name="validade" type="date" defaultValue={cliente?.validade ?? ""} className={CAMPO} />
      </div>
      <CampoValor
        nome="financiamento_contratado"
        rotulo="Financiamento contratado (R$)"
        valorInicial={cliente?.financiamento_contratado}
        onChange={setContratado}
      />
      <CampoValor
        nome="valor_aprovado"
        rotulo="Valor aprovado (R$)"
        valorInicial={cliente?.valor_aprovado}
        onChange={setAprovado}
      />
      <div>
        <label className="block text-sm font-medium text-slate-700">Diferença (aprovado − contratado)</label>
        <input
          disabled
          value={diferenca.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
        />
      </div>
      <CampoValor nome="fgts_contratado" rotulo="FGTS contratado (R$)" valorInicial={cliente?.fgts_contratado} />
      <CampoValor nome="fgts_atualizacao" rotulo="FGTS atualização (R$)" valorInicial={cliente?.fgts_atualizacao} />
      <CampoValor nome="terreno" rotulo="Terreno (R$)" valorInicial={cliente?.terreno} />
      <CampoValor nome="seguro" rotulo="Seguro (R$)" valorInicial={cliente?.seguro} />
      <CampoValor nome="escritura" rotulo="Escritura (R$)" valorInicial={cliente?.escritura} />
    </div>
  );
}
