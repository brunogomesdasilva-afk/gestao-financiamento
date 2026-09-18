import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/auth";
import type { Empreendimento } from "@/lib/database.types";
import { atualizarEspelhoVendas } from "../actions";

export default async function AtualizarEspelhoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; empreendimento?: string }>;
}) {
  await exigirAdmin();
  const { erro, empreendimento } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.from("empreendimentos").select("*").order("nome");
  const empreendimentos = (data ?? []) as Empreendimento[];

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/empreendimentos" className="text-xs text-slate-500 hover:text-slate-900">
        ← Empreendimentos cadastrados
      </Link>
      <h1 className="mt-1 text-lg font-semibold text-slate-900">Atualizar espelho de vendas</h1>
      <p className="mt-1 text-sm text-slate-500">
        Escolha o empreendimento e envie o espelho de vendas atual, em foto ou planilha. O status de cada
        unidade é atualizado e tudo o que mudou desde a última atualização fica registrado no histórico da
        unidade.
      </p>

      {erro && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {empreendimentos.length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Nenhum empreendimento cadastrado ainda.{" "}
          <Link href="/empreendimentos/importar" className="underline hover:text-slate-900">
            Cadastre o primeiro
          </Link>
          .
        </p>
      ) : (
        <form
          action={atualizarEspelhoVendas}
          className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700">Empreendimento</label>
            <select
              name="empreendimento_id"
              required
              defaultValue={empreendimento ?? ""}
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
            <label className="block text-sm font-medium text-slate-700">
              Espelho de vendas (foto .png ou planilha .xlsx / .xltx)
            </label>
            <input type="file" name="arquivo" accept=".png,.xlsx,.xltx" required className="mt-1 w-full text-sm" />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Atualizar espelho de vendas
          </button>
        </form>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        <h2 className="text-sm font-semibold text-slate-900">Como o arquivo é lido</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Foto (.png):</strong> o status de cada unidade vem da cor, conforme a legenda do espelho.
            Os blocos da foto, da esquerda para a direita, correspondem às torres do empreendimento em ordem
            de nome.
          </li>
          <li>
            <strong>Planilha:</strong> o status vem da coluna <strong>Status</strong> (com as colunas
            Unidade e Bloco) ou, se não houver, das cores das células.
          </li>
          <li>Ao terminar, você vê o resumo da leitura para conferir com a legenda do espelho.</li>
        </ul>
      </div>
    </div>
  );
}
