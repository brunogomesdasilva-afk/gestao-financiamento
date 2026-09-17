"use client";

import type { StatusUnidadeConfig } from "@/lib/database.types";

export function UnidadeStatusForm({
  status,
  opcoes,
  action,
}: {
  status: string;
  opcoes: StatusUnidadeConfig[];
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action}>
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="bg-transparent text-[11px] focus:outline-none"
      >
        {opcoes.map((opcao) => (
          <option key={opcao.nome} value={opcao.nome}>
            {opcao.nome}
          </option>
        ))}
      </select>
    </form>
  );
}
