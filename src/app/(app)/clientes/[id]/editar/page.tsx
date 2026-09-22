import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  Cliente,
  Empreendimento,
  Etapa,
  ModalidadeFinanciamento,
  Profile,
  Torre,
  Unidade,
} from "@/lib/database.types";
import { getBancos } from "@/lib/bancos";
import { getPerfilAtual } from "@/lib/auth";
import { atualizarCliente } from "../../actions";
import { CamposFinanciamento } from "../../CamposFinanciamento";

const CAMPO = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

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

  const [{ data: cliente }, { data: usuarios }, { data: modalidades }, { data: etapas }, bancos, perfilAtual] =
    await Promise.all([
      supabase.from("clientes").select("*").eq("id", id).single(),
      supabase.from("profiles").select("*").order("nome"),
      supabase.from("modalidades_financiamento").select("*").order("ordem"),
      supabase.from("etapas").select("*").order("ordem", { ascending: true }),
      getBancos(),
      getPerfilAtual(),
    ]);

  if (!cliente) notFound();
  const clienteTyped = cliente as Cliente;
  const souAdmin = perfilAtual?.perfil === "admin";
  // Só o dono da unidade ou o administrador editam; os demais só podem consultar.
  if (!souAdmin && clienteTyped.analista_responsavel_id !== perfilAtual?.id) {
    redirect(`/clientes/${id}`);
  }
  const todasEtapas = (etapas ?? []) as Etapa[];
  // Sem ser administrador, só aparecem as etapas livres, mais a etapa atual (mesmo se for restrita,
  // para não sumir da tela) — assim dá para ver o status sem poder trocar para DISTRATO/REPASSADO.
  const etapasTyped = souAdmin
    ? todasEtapas
    : todasEtapas.filter((e) => !e.restrita_admin || e.id === clienteTyped.etapa_atual_id);
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
              <label className="block text-sm font-medium text-slate-700">Nome do proprietário</label>
              <input name="nome" defaultValue={clienteTyped.nome ?? ""} className={CAMPO} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">CPF</label>
              <input name="cpf" defaultValue={clienteTyped.cpf ?? ""} className={CAMPO} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Telefone</label>
              <input name="telefone" defaultValue={clienteTyped.telefone ?? ""} className={CAMPO} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700">E-mail</label>
              <input name="email" type="email" defaultValue={clienteTyped.email ?? ""} className={CAMPO} />
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
          <div className="mt-3">
            <CamposFinanciamento modalidades={modalidadesTyped} bancos={bancos} cliente={clienteTyped} />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-900">Andamento</h2>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Status</label>
              <select name="etapa_id" defaultValue={clienteTyped.etapa_atual_id ?? ""} className={CAMPO}>
                {etapasTyped.map((etapa) => (
                  <option key={etapa.id} value={etapa.id}>
                    {etapa.nome}
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
          <textarea name="observacoes" rows={3} defaultValue={clienteTyped.observacoes ?? ""} className={CAMPO} />
        </div>

        <button type="submit" className="w-full rounded-md bg-marca px-3 py-2 text-sm font-medium text-white hover:bg-marca-escuro">
          Salvar alterações
        </button>
      </form>
    </div>
  );
}
