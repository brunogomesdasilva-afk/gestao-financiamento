import { createClient } from "@/lib/supabase/server";
import type { ModalidadeFinanciamento, Profile } from "@/lib/database.types";
import { getEmpreendimentosTorresEUnidadesDisponiveis } from "@/lib/unidades";
import { criarCliente } from "../actions";
import { SeletorUnidade } from "../SeletorUnidade";

export default async function NovoClientePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const supabase = await createClient();

  const [{ empreendimentos, torres, unidades }, { data: usuarios }, { data: modalidades }] =
    await Promise.all([
      getEmpreendimentosTorresEUnidadesDisponiveis(),
      supabase.from("profiles").select("*").order("nome"),
      supabase.from("modalidades_financiamento").select("*").order("ordem"),
    ]);

  const usuariosTyped = (usuarios as Profile[] | null) ?? [];
  const modalidadesTyped = (modalidades as ModalidadeFinanciamento[] | null) ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-lg font-semibold text-slate-900">Novo cliente</h1>
      <p className="mt-1 text-sm text-slate-500">
        Cadastre um cliente já aprovado para acompanhar o andamento do financiamento. Só aparecem
        unidades com status <strong>Vendida</strong> que ainda não têm cliente vinculado.
      </p>

      {erro && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      <form action={criarCliente} className="mt-6 space-y-6 rounded-xl border border-slate-200 bg-white p-6">
        <section>
          <h2 className="text-sm font-semibold text-slate-900">Dados pessoais</h2>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700">Nome completo</label>
              <input name="nome" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">CPF</label>
              <input name="cpf" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Telefone</label>
              <input name="telefone" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700">E-mail</label>
              <input name="email" type="email" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-900">Unidade</h2>
          <div className="mt-3">
            <SeletorUnidade empreendimentos={empreendimentos} torres={torres} unidades={unidades} />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-900">Financiamento</h2>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Banco financiador</label>
              <input name="banco_financiador" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Agência</label>
              <input name="agencia_financiamento" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Modalidade</label>
              <select name="modalidade_financiamento_id" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">Selecione</option>
                {modalidadesTyped.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Validade da aprovação</label>
              <input name="validade" type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Financiamento contratado (R$)</label>
              <input name="financiamento_contratado" placeholder="250000" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Valor aprovado (R$)</label>
              <input name="valor_aprovado" placeholder="250000" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">FGTS contratado (R$)</label>
              <input name="fgts_contratado" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">FGTS atualização (R$)</label>
              <input name="fgts_atualizacao" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Terreno (R$)</label>
              <input name="terreno" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Seguro (R$)</label>
              <input name="seguro" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Escritura (R$)</label>
              <input name="escritura" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-900">Responsáveis</h2>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Corretor responsável</label>
              <select name="corretor_responsavel_id" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">Selecione</option>
                {usuariosTyped.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Analista responsável</label>
              <select name="analista_responsavel_id" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">Selecione</option>
                {usuariosTyped.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <div>
          <label className="block text-sm font-medium text-slate-700">Observações</label>
          <textarea name="observacoes" rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <button type="submit" className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Cadastrar cliente
        </button>
      </form>
    </div>
  );
}
