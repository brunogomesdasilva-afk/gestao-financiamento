import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Cliente, Empreendimento, ModalidadeFinanciamento, Profile, Torre, Unidade } from "@/lib/database.types";
import { atualizarCliente } from "../../actions";

export default async function EditarClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const supabase = await createClient();

  const [{ data: cliente }, { data: usuarios }, { data: modalidades }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase.from("profiles").select("*").order("nome"),
    supabase.from("modalidades_financiamento").select("*").order("ordem"),
  ]);

  if (!cliente) notFound();
  const clienteTyped = cliente as Cliente;
  const usuariosTyped = (usuarios as Profile[] | null) ?? [];
  const modalidadesTyped = (modalidades as ModalidadeFinanciamento[] | null) ?? [];

  const { data: unidadeData } = clienteTyped.unidade_id
    ? await supabase.from("unidades").select("*").eq("id", clienteTyped.unidade_id).single()
    : { data: null };
  const unidade = unidadeData as Unidade | null;
  const { data: torreData } = unidade
    ? await supabase.from("torres").select("*").eq("id", unidade.torre_id).single()
    : { data: null };
  const torre = torreData as Torre | null;
  const { data: empreendimentoData } = clienteTyped.empreendimento_id
    ? await supabase.from("empreendimentos").select("*").eq("id", clienteTyped.empreendimento_id).single()
    : { data: null };
  const empreendimento = empreendimentoData as Empreendimento | null;
  const analista = usuariosTyped.find((p) => p.id === clienteTyped.analista_responsavel_id);
  const atualizarComId = atualizarCliente.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-lg font-semibold text-slate-900">Editar cliente</h1>

      {erro && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      <form action={atualizarComId} className="mt-6 space-y-6 rounded-xl border border-slate-200 bg-white p-6">
        <section>
          <h2 className="text-sm font-semibold text-slate-900">Dados pessoais</h2>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700">Nome completo</label>
              <input name="nome" required defaultValue={clienteTyped.nome} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">CPF</label>
              <input name="cpf" defaultValue={clienteTyped.cpf ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Telefone</label>
              <input name="telefone" defaultValue={clienteTyped.telefone ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700">E-mail</label>
              <input name="email" type="email" defaultValue={clienteTyped.email ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-900">Unidade</h2>
          <p className="mt-3 text-sm text-slate-700">
            {empreendimento?.nome ?? "—"}
            {torre ? ` · ${torre.nome}` : ""}
            {unidade ? ` · Unidade ${unidade.numero}` : ""}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            A unidade é definida ao assumir a análise e não pode ser trocada aqui.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-900">Financiamento</h2>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Banco financiador</label>
              <input name="banco_financiador" defaultValue={clienteTyped.banco_financiador ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Agência</label>
              <input name="agencia_financiamento" defaultValue={clienteTyped.agencia_financiamento ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Modalidade</label>
              <select name="modalidade_financiamento_id" defaultValue={clienteTyped.modalidade_financiamento_id ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
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
              <input name="validade" type="date" defaultValue={clienteTyped.validade ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Financiamento contratado (R$)</label>
              <input name="financiamento_contratado" defaultValue={clienteTyped.financiamento_contratado ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Valor aprovado (R$)</label>
              <input name="valor_aprovado" defaultValue={clienteTyped.valor_aprovado ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">FGTS contratado (R$)</label>
              <input name="fgts_contratado" defaultValue={clienteTyped.fgts_contratado ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">FGTS atualização (R$)</label>
              <input name="fgts_atualizacao" defaultValue={clienteTyped.fgts_atualizacao ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Terreno (R$)</label>
              <input name="terreno" defaultValue={clienteTyped.terreno ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Seguro (R$)</label>
              <input name="seguro" defaultValue={clienteTyped.seguro ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Escritura (R$)</label>
              <input name="escritura" defaultValue={clienteTyped.escritura ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Diferença (aprovado − contratado)</label>
              <input
                disabled
                value={
                  clienteTyped.diferenca_aprovacao_contratado != null
                    ? clienteTyped.diferenca_aprovacao_contratado.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    : "—"
                }
                className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-900">Responsáveis</h2>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Corretor responsável</label>
              <select name="corretor_responsavel_id" defaultValue={clienteTyped.corretor_responsavel_id ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
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
              <input
                disabled
                value={analista?.nome ?? "—"}
                className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
            </div>
          </div>
        </section>

        <div>
          <label className="block text-sm font-medium text-slate-700">Observações</label>
          <textarea name="observacoes" rows={3} defaultValue={clienteTyped.observacoes ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <button type="submit" className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Salvar alterações
        </button>
      </form>
    </div>
  );
}
