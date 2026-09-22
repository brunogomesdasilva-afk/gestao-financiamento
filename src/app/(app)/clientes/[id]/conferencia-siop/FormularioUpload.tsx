"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CartaoResultadoSiop } from "@/app/(app)/conferencia-siop/CartaoResultadoSiop";
import { conferirUploadAction, type EstadoConferenciaAvulsa } from "./actions";

const ESTADO_INICIAL: EstadoConferenciaAvulsa = { resultado: null, erro: null };

function BotaoConferir() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-marca px-4 py-2 text-sm font-medium text-white hover:bg-marca-escuro disabled:opacity-60"
    >
      {pending ? "Conferindo..." : "Conferir"}
    </button>
  );
}

export function FormularioUpload({ clienteId }: { clienteId: string }) {
  const [estado, acao] = useActionState(conferirUploadAction.bind(null, clienteId), ESTADO_INICIAL);

  return (
    <div>
      <form action={acao} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-5">
        <div className="min-w-72 flex-1">
          <label className="block text-sm font-medium text-slate-700">Arquivo do SIOP (PDF)</label>
          <input
            type="file"
            name="arquivo"
            accept="application/pdf,.pdf"
            required
            className="mt-1 w-full text-sm"
          />
        </div>
        <BotaoConferir />
      </form>

      {estado.erro && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>}

      {estado.resultado && (
        <div className="mt-4">
          <CartaoResultadoSiop r={estado.resultado} />
        </div>
      )}
    </div>
  );
}
