"use client";

import { useState } from "react";
import type { Banco } from "@/lib/bancos";
import type { Cliente, ModalidadeFinanciamento } from "@/lib/database.types";

const CAMPO = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Campo de valor em reais: só aceita números e mostra o valor formatado enquanto se digita
// (os dígitos entram pelos centavos, como em um caixa eletrônico). O formulário envia o valor
// puro (ex.: "250000,50") em um campo oculto.
function CampoMoeda({
  nome,
  rotulo,
  valorInicial,
  onChange,
}: {
  nome: string;
  rotulo: string;
  valorInicial: number | null | undefined;
  onChange?: (valor: number | null) => void;
}) {
  const [centavos, setCentavos] = useState<number | null>(
    valorInicial == null ? null : Math.round(valorInicial * 100)
  );

  function alterar(texto: string) {
    const digitos = texto.replace(/\D/g, "").slice(0, 12);
    const novo = digitos === "" ? null : Number(digitos);
    setCentavos(novo);
    onChange?.(novo == null ? null : novo / 100);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{rotulo}</label>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="R$ 0,00"
        value={centavos == null ? "" : MOEDA.format(centavos / 100)}
        onChange={(e) => alterar(e.target.value)}
        className={CAMPO}
      />
      <input
        type="hidden"
        name={nome}
        value={centavos == null ? "" : (centavos / 100).toFixed(2).replace(".", ",")}
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
  const [aprovado, setAprovado] = useState<number | null>(cliente?.valor_aprovado ?? null);
  const [contratado, setContratado] = useState<number | null>(cliente?.financiamento_contratado ?? null);

  const diferenca = (aprovado ?? 0) - (contratado ?? 0);

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
        <input
          name="agencia_financiamento"
          maxLength={4}
          autoComplete="off"
          defaultValue={cliente?.agencia_financiamento ?? ""}
          className={CAMPO}
        />
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
      <CampoMoeda
        nome="valor_compra"
        rotulo="Valor de compra e venda"
        valorInicial={cliente?.valor_compra}
      />
      <CampoMoeda
        nome="financiamento_contratado"
        rotulo="Financiamento contratado"
        valorInicial={cliente?.financiamento_contratado}
        onChange={setContratado}
      />
      <CampoMoeda
        nome="valor_aprovado"
        rotulo="Valor aprovado"
        valorInicial={cliente?.valor_aprovado}
        onChange={setAprovado}
      />
      <div>
        <label className="block text-sm font-medium text-slate-700">Diferença (aprovado − contratado)</label>
        <input
          disabled
          value={MOEDA.format(diferenca)}
          className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
        />
      </div>
      <CampoMoeda nome="fgts_contratado" rotulo="FGTS contratado" valorInicial={cliente?.fgts_contratado} />
      <CampoMoeda nome="fgts_atualizacao" rotulo="FGTS atualização" valorInicial={cliente?.fgts_atualizacao} />
      <CampoMoeda nome="terreno" rotulo="Terreno" valorInicial={cliente?.terreno} />
      <CampoMoeda nome="seguro" rotulo="Seguro" valorInicial={cliente?.seguro} />
      <CampoMoeda nome="escritura" rotulo="Escritura" valorInicial={cliente?.escritura} />
    </div>
  );
}
