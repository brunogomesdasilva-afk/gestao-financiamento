import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AndamentoHistorico, Cliente, Empreendimento, Etapa, Profile } from "@/lib/database.types";
import { avancarEtapa, arquivarCliente } from "../actions";

function formatMoeda(valor: number | null) {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatData(data: string) {
  return new Date(data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function ClienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: cliente }, { data: etapas }, { data: historico }, { data: usuarios }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase.from("etapas").select("*").order("ordem", { ascending: true }),
    supabase
      .from("andamento_historico")
      .select("*")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("*"),
  ]);

  if (!cliente) notFound();

  const clienteTyped = cliente as Cliente;

  let empreendimento: Empreendimento | null = null;
  if (clienteTyped.empreendimento_id) {
    const { data } = await supabase
      .from("empreendimentos")
      .select("*")
      .eq("id", clienteTyped.empreendimento_id)
      .single();
    empreendimento = data;
  }

  const etapasTyped = (etapas ?? []) as Etapa[];
  const etapaAtual = etapasTyped.find((e) => e.id === clienteTyped.etapa_atual_id);
  const usuariosPorId = new Map<string, Profile>((usuarios ?? []).map((u: Profile) => [u.id, u]));

  const avancarEtapaComId = avancarEtapa.bind(null, id);
  const arquivarComId = arquivarCliente.bind(null, id, !clienteTyped.arquivado);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">{clienteTyped.nome}</h1>
              {empreendimento && (
                <p className="text-sm text-slate-500">
                  {empreendimento.nome}
                  {clienteTyped.unidade ? ` · Unidade ${clienteTyped.unidade}` : ""}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Link
                href={`/clientes/${id}/editar`}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Editar
              </Link>
              <form action={arquivarComId}>
                <button
                  type="submit"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {clienteTyped.arquivado ? "Reativar" : "Arquivar"}
                </button>
              </form>
            </div>
          </div>

          {etapaAtual && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: etapaAtual.cor }} />
              <span className="text-xs font-medium text-slate-700">{etapaAtual.nome}</span>
            </div>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-400">CPF</dt>
              <dd className="text-slate-900">{clienteTyped.cpf ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Telefone</dt>
              <dd className="text-slate-900">{clienteTyped.telefone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">E-mail</dt>
              <dd className="text-slate-900">{clienteTyped.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Banco financiador</dt>
              <dd className="text-slate-900">{clienteTyped.banco_financiador ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Valor financiado</dt>
              <dd className="text-slate-900">{formatMoeda(clienteTyped.valor_financiado)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Corretor responsável</dt>
              <dd className="text-slate-900">
                {clienteTyped.corretor_responsavel_id
                  ? usuariosPorId.get(clienteTyped.corretor_responsavel_id)?.nome ?? "—"
                  : "—"}
              </dd>
            </div>
          </dl>

          {clienteTyped.observacoes && (
            <div className="mt-4">
              <dt className="text-sm text-slate-400">Observações</dt>
              <dd className="mt-1 text-sm text-slate-700">{clienteTyped.observacoes}</dd>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-900">Histórico de andamento</h2>
          <ol className="mt-4 space-y-4">
            {((historico ?? []) as AndamentoHistorico[]).map((item) => {
              const etapa = etapasTyped.find((e) => e.id === item.etapa_id);
              const usuario = item.usuario_id ? usuariosPorId.get(item.usuario_id) : null;
              return (
                <li key={item.id} className="border-l-2 border-slate-200 pl-4">
                  <p className="text-sm font-medium text-slate-900">{etapa?.nome ?? "Etapa removida"}</p>
                  {item.observacao && <p className="text-sm text-slate-600">{item.observacao}</p>}
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatData(item.created_at)}
                    {usuario ? ` · ${usuario.nome}` : ""}
                  </p>
                </li>
              );
            })}
            {(historico ?? []).length === 0 && (
              <p className="text-sm text-slate-400">Nenhum registro ainda.</p>
            )}
          </ol>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Avançar etapa</h2>
        <form action={avancarEtapaComId} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Nova etapa</label>
            <select
              name="etapa_id"
              required
              defaultValue={clienteTyped.etapa_atual_id ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {etapasTyped.map((etapa) => (
                <option key={etapa.id} value={etapa.id}>
                  {etapa.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Observação</label>
            <textarea
              name="observacao"
              rows={3}
              placeholder="O que aconteceu nesta etapa?"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Registrar andamento
          </button>
        </form>
      </div>
    </div>
  );
}
