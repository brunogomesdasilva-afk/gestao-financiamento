import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Etapa, ModalidadeFinanciamento } from "@/lib/database.types";
import { getBancos } from "@/lib/bancos";
import { getUnidadesParaAssumir } from "@/lib/unidades";
import { assumirUnidade } from "../actions";
import { CamposFinanciamento } from "../CamposFinanciamento";
import { SeletorUnidade } from "../SeletorUnidade";

const CAMPO = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

export default async function AssumirUnidadePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const supabase = await createClient();

  const [{ empreendimentos, torres, unidades }, { data: modalidades }, { data: etapas }, { data: auth }, bancos] =
    await Promise.all([
      getUnidadesParaAssumir(),
      supabase.from("modalidades_financiamento").select("*").order("ordem"),
      supabase.from("etapas").select("*").order("ordem", { ascending: true }),
      supabase.auth.getUser(),
      getBancos(),
    ]);

  let nomeAnalista = auth.user?.email ?? "";
  if (auth.user) {
    const { data: perfil } = await supabase.from("profiles").select("nome").eq("id", auth.user.id).single();
    if (perfil?.nome) nomeAnalista = perfil.nome;
  }

  const etapasTyped = (etapas ?? []) as Etapa[];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/clientes" className="text-xs text-slate-500 hover:text-slate-900">
        ← Minha carteira
      </Link>
      <h1 className="mt-1 text-lg font-semibold text-slate-900">Assumir unidade</h1>
      <p className="mt-1 text-sm text-slate-500">
        Escolha o empreendimento, o bloco e a unidade cujo financiamento você vai analisar. Ao assumir,
        a unidade fica com você até ser concluída e nenhum outro analista consegue pegá-la. Só aparecem
        unidades com status <strong>Vendido</strong> que ainda não têm analista. Todos os dados abaixo
        são opcionais e podem ser completados depois.
      </p>

      {erro && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      {unidades.length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Nenhuma unidade disponível para assumir no momento.
        </p>
      ) : (
        <form
          action={assumirUnidade}
          className="mt-6 space-y-6 rounded-xl border border-slate-200 bg-white p-6"
        >
          <section>
            <h2 className="text-sm font-semibold text-slate-900">Unidade</h2>
            <div className="mt-3">
              <SeletorUnidade empreendimentos={empreendimentos} torres={torres} unidades={unidades} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900">Proprietário e andamento</h2>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nome do proprietário</label>
                <input name="nome" className={CAMPO} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Status</label>
                <select name="etapa_id" defaultValue={etapasTyped[0]?.id} className={CAMPO}>
                  {etapasTyped.map((etapa) => (
                    <option key={etapa.id} value={etapa.id}>
                      {etapa.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700">Analista responsável</label>
                <input
                  disabled
                  value={nomeAnalista}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900">Financiamento</h2>
            <div className="mt-3">
              <CamposFinanciamento
                modalidades={(modalidades ?? []) as ModalidadeFinanciamento[]}
                bancos={bancos}
              />
            </div>
          </section>

          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Assumir análise
          </button>
        </form>
      )}
    </div>
  );
}
