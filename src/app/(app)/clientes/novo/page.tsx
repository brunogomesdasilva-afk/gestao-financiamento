import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Etapa, ModalidadeFinanciamento } from "@/lib/database.types";
import { getBancos } from "@/lib/bancos";
import { getUnidadesParaAssumir } from "@/lib/unidades";
import { assumirUnidade } from "../actions";
import { CamposFinanciamento } from "../CamposFinanciamento";

const CAMPO = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const LIMITE_LISTA = 300;

export default async function AssumirUnidadePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; unidade?: string; empreendimento?: string; torre?: string; q?: string }>;
}) {
  const { erro, unidade: unidadeEscolhidaId, empreendimento: empFiltro, torre: torreFiltro, q } = await searchParams;
  const { empreendimentos, torres, unidades } = await getUnidadesParaAssumir();

  const empPorId = new Map(empreendimentos.map((e) => [e.id, e]));
  const torrePorId = new Map(torres.map((t) => [t.id, t]));
  const descrever = (u: (typeof unidades)[number]) => {
    const torre = torrePorId.get(u.torre_id);
    return {
      id: u.id,
      torreId: u.torre_id,
      empreendimentoId: torre?.empreendimento_id ?? "",
      empreendimento: (torre ? empPorId.get(torre.empreendimento_id)?.nome : undefined) ?? "—",
      torre: torre?.nome ?? "—",
      numero: u.numero,
    };
  };

  const escolhida = unidadeEscolhidaId ? unidades.find((u) => u.id === unidadeEscolhidaId) : undefined;
  const erroExibido =
    erro ??
    (unidadeEscolhidaId && !escolhida ? "Essa unidade não está mais disponível para assumir." : undefined);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={escolhida ? "/clientes/novo" : "/clientes"} className="text-xs text-slate-500 hover:text-slate-900">
        {escolhida ? "← Unidades disponíveis" : "← Minha carteira"}
      </Link>
      <h1 className="mt-1 text-lg font-semibold text-slate-900">Assumir unidade</h1>

      {erroExibido && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erroExibido}</p>}

      {escolhida ? (
        <FormularioAssumir unidade={descrever(escolhida)} />
      ) : (
        <ListaDisponiveis
          empreendimentos={empreendimentos}
          torres={torres}
          unidades={unidades.map(descrever)}
          empFiltro={empFiltro ?? ""}
          torreFiltro={torreFiltro ?? ""}
          busca={q ?? ""}
        />
      )}
    </div>
  );
}

type UnidadeDescrita = {
  id: string;
  empreendimentoId: string;
  empreendimento: string;
  torreId: string;
  torre: string;
  numero: string;
};

function ListaDisponiveis({
  empreendimentos,
  torres,
  unidades,
  empFiltro,
  torreFiltro,
  busca,
}: {
  empreendimentos: { id: string; nome: string }[];
  torres: { id: string; nome: string; empreendimento_id: string }[];
  unidades: UnidadeDescrita[];
  empFiltro: string;
  torreFiltro: string;
  busca: string;
}) {
  const torresDoFiltro = torres.filter((t) => !empFiltro || t.empreendimento_id === empFiltro);
  const termo = busca.trim().toLowerCase();

  const filtradas = unidades
    .filter((u) => !empFiltro || u.empreendimentoId === empFiltro)
    .filter((u) => !torreFiltro || u.torreId === torreFiltro)
    .filter((u) => !termo || u.numero.toLowerCase().includes(termo))
    .sort(
      (a, b) =>
        a.empreendimento.localeCompare(b.empreendimento, "pt-BR") ||
        a.torre.localeCompare(b.torre, "pt-BR", { numeric: true }) ||
        a.numero.localeCompare(b.numero, "pt-BR", { numeric: true })
    );
  const exibidas = filtradas.slice(0, LIMITE_LISTA);

  return (
    <>
      <p className="mt-1 text-sm text-slate-500">
        Estas são as unidades <strong>vendidas</strong> que ainda não têm analista. Clique na unidade que
        você vai analisar para preencher o proprietário e os dados do financiamento. Ao assumir, a unidade
        fica com você até ser concluída e nenhum outro analista consegue pegá-la.
      </p>

      <form method="get" className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-slate-500">Empreendimento</label>
          <select name="empreendimento" defaultValue={empFiltro} className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Todos</option>
            {empreendimentos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Bloco</label>
          <select name="torre" defaultValue={torreFiltro} className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Todos</option>
            {torresDoFiltro.map((t) => (
              <option key={t.id} value={t.id}>
                {empFiltro ? t.nome : `${empreendimentos.find((e) => e.id === t.empreendimento_id)?.nome ?? ""} · ${t.nome}`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Unidade</label>
          <input
            name="q"
            defaultValue={busca}
            placeholder="Número"
            className="mt-1 w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button type="submit" className="rounded-md bg-grafite px-3 py-1.5 text-sm font-medium text-white hover:bg-grafite-escuro">
          Filtrar
        </button>
        {(empFiltro || torreFiltro || busca) && (
          <Link href="/clientes/novo" className="pb-1.5 text-sm text-slate-500 underline hover:text-slate-900">
            Limpar
          </Link>
        )}
      </form>

      <p className="mt-4 text-sm text-slate-600">
        <strong className="tabular-nums">{filtradas.length}</strong>{" "}
        {filtradas.length === 1 ? "unidade disponível" : "unidades disponíveis"} sem analista
      </p>

      {filtradas.length === 0 ? (
        <p className="mt-3 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Nenhuma unidade disponível para assumir{unidades.length > 0 ? " com esses filtros" : " no momento"}.
        </p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Empreendimento</th>
                <th className="px-4 py-2 font-medium">Bloco</th>
                <th className="px-4 py-2 font-medium">Unidade</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exibidas.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-900">
                    <Link href={`/clientes/novo?unidade=${u.id}`} className="block">
                      {u.empreendimento}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{u.torre}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{u.numero}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/clientes/novo?unidade=${u.id}`}
                      className="rounded-md bg-marca px-3 py-1 text-xs font-medium text-white hover:bg-marca-escuro"
                    >
                      Assumir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtradas.length > exibidas.length && (
            <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
              Mostrando as primeiras {exibidas.length}. Use os filtros para ver as demais.
            </p>
          )}
        </div>
      )}
    </>
  );
}

async function FormularioAssumir({ unidade }: { unidade: UnidadeDescrita }) {
  const supabase = await createClient();
  const [{ data: modalidades }, { data: etapas }, { data: auth }, bancos] = await Promise.all([
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
    <>
      <p className="mt-1 text-sm text-slate-500">
        Preencha os dados abaixo. Todos são opcionais e podem ser completados depois.
      </p>

      <form action={assumirUnidade} className="mt-6 space-y-6 rounded-xl border border-slate-200 bg-white p-6">
        <input type="hidden" name="unidade_id" value={unidade.id} />

        <section>
          <h2 className="text-sm font-semibold text-slate-900">Unidade</h2>
          <dl className="mt-3 grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-slate-400">Empreendimento</dt>
              <dd className="font-medium text-slate-900">{unidade.empreendimento}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Bloco</dt>
              <dd className="font-medium text-slate-900">{unidade.torre}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Unidade</dt>
              <dd className="font-medium text-slate-900">{unidade.numero}</dd>
            </div>
          </dl>
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
            <CamposFinanciamento modalidades={(modalidades ?? []) as ModalidadeFinanciamento[]} bancos={bancos} />
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="flex-1 rounded-md bg-marca px-3 py-2 text-sm font-medium text-white hover:bg-marca-escuro"
          >
            Assumir análise
          </button>
          <Link href="/clientes/novo" className="text-sm text-slate-600 underline hover:text-slate-900">
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}
