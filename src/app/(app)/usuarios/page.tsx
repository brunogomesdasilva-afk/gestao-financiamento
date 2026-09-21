import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/auth";
import type { Profile } from "@/lib/database.types";
import { alterarNomeUsuario, alterarPerfilUsuario, alterarStatusUsuario, criarUsuario } from "./actions";

const CAMPO = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const ROTULO_PERFIL = { admin: "Administrador", analista: "Analista" } as const;

type UnidadeEmCarteira = { clienteId: string; descricao: string };

// Unidades em andamento (não arquivadas) que estão em nome do usuário: empreendimento · bloco · unidade.
async function unidadesDoUsuario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  usuarioId: string
): Promise<UnidadeEmCarteira[]> {
  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, nome, unidade_id")
    .eq("analista_responsavel_id", usuarioId)
    .eq("arquivado", false);
  const lista = clientes ?? [];
  if (lista.length === 0) return [];

  const unidadeIds = lista.map((c) => c.unidade_id).filter((id): id is string => Boolean(id));
  const { data: unidades } = unidadeIds.length
    ? await supabase.from("unidades").select("id, numero, torre_id").in("id", unidadeIds)
    : { data: [] };
  const torreIds = Array.from(new Set((unidades ?? []).map((u) => u.torre_id)));
  const [{ data: torres }, { data: empreendimentos }] = await Promise.all([
    torreIds.length ? supabase.from("torres").select("id, nome, empreendimento_id").in("id", torreIds) : Promise.resolve({ data: [] }),
    supabase.from("empreendimentos").select("id, nome"),
  ]);

  const unidadePorId = new Map((unidades ?? []).map((u) => [u.id, u]));
  const torrePorId = new Map((torres ?? []).map((t) => [t.id, t]));
  const empPorId = new Map((empreendimentos ?? []).map((e) => [e.id, e.nome]));

  return lista
    .map((c) => {
      const u = c.unidade_id ? unidadePorId.get(c.unidade_id) : undefined;
      const t = u ? torrePorId.get(u.torre_id) : undefined;
      const emp = t ? empPorId.get(t.empreendimento_id) : undefined;
      const descricao = u
        ? `${emp ?? "Empreendimento"} · ${t?.nome ?? "Torre"} · Unidade ${u.numero}`
        : `Sem unidade vinculada${c.nome ? ` · ${c.nome}` : ""}`;
      return { clienteId: c.id, descricao };
    })
    .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR", { numeric: true }));
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string; inativar?: string }>;
}) {
  const atual = await exigirAdmin();
  const { erro, ok, inativar } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("nome");
  const usuarios = (data ?? []) as Profile[];
  const chaveConfigurada = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const nomePorId = new Map(usuarios.map((u) => [u.id, u.nome]));

  const alvoInativar = inativar && inativar !== atual.id ? usuarios.find((u) => u.id === inativar && u.ativo !== false) : undefined;
  const unidadesAlvo = alvoInativar ? await unidadesDoUsuario(supabase, alvoInativar.id) : [];
  const destinos = usuarios.filter((u) => u.ativo !== false && u.id !== alvoInativar?.id);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h1 className="text-lg font-semibold text-slate-900">Usuários</h1>
        <p className="mt-1 text-sm text-slate-500">
          Administradores veem e gerenciam tudo. Analistas veem só as unidades que assumiram e as que
          estão livres para assumir. O nome é o que aparece nos históricos e na carteira, no lugar do
          e-mail.
        </p>

        {erro && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        {ok && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</p>}

        {alvoInativar && (
          <form
            action={alterarStatusUsuario.bind(null, alvoInativar.id)}
            className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-5"
          >
            <input type="hidden" name="ativo" value="false" />
            <h2 className="text-sm font-semibold text-amber-900">Inativar {alvoInativar.nome}</h2>
            <p className="mt-1 text-sm text-amber-900">
              O usuário deixa de ter acesso ao sistema, mas continua no histórico. Você pode reativá-lo depois.
            </p>

            {unidadesAlvo.length > 0 ? (
              <>
                <p className="mt-3 text-sm font-medium text-amber-900">
                  Este usuário tem {unidadesAlvo.length} {unidadesAlvo.length === 1 ? "unidade" : "unidades"} em
                  andamento em nome dele:
                </p>
                <ul className="mt-2 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-sm text-amber-900">
                  {unidadesAlvo.map((u) => (
                    <li key={u.clienteId}>{u.descricao}</li>
                  ))}
                </ul>
                <label className="mt-4 block text-sm font-medium text-amber-900">
                  Enviar essas unidades para
                </label>
                <select name="destino" required defaultValue="" className={CAMPO}>
                  <option value="" disabled>
                    Selecione o usuário de destino
                  </option>
                  {destinos.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome} ({ROTULO_PERFIL[u.perfil]})
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-amber-800">
                  Cada transferência fica registrada no histórico da unidade, com o seu nome como responsável pela
                  alteração.
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-amber-900">Este usuário não tem unidades em andamento.</p>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                type="submit"
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                {unidadesAlvo.length > 0 ? "Transferir unidades e inativar" : "Inativar usuário"}
              </button>
              <Link href="/usuarios" className="text-sm text-slate-600 underline hover:text-slate-900">
                Cancelar
              </Link>
            </div>
          </form>
        )}

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">E-mail</th>
                <th className="px-4 py-2 font-medium">Perfil</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios.map((u) => (
                <tr key={u.id} className={u.ativo === false ? "bg-slate-50 text-slate-400" : undefined}>
                  <td className="px-4 py-2">
                    <form action={alterarNomeUsuario.bind(null, u.id)} className="flex items-center gap-2">
                      <input
                        name="nome"
                        defaultValue={u.nome}
                        required
                        maxLength={80}
                        className="w-full min-w-40 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
                      />
                      <button type="submit" className="text-xs text-slate-500 underline hover:text-slate-900">
                        salvar
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{u.email}</td>
                  <td className="px-4 py-2">
                    {u.id === atual.id ? (
                      <span className="text-slate-600">{ROTULO_PERFIL[u.perfil]} (você)</span>
                    ) : (
                      <form action={alterarPerfilUsuario.bind(null, u.id)} className="flex items-center gap-2">
                        <select
                          name="perfil"
                          defaultValue={u.perfil}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                        >
                          <option value="analista">Analista</option>
                          <option value="admin">Administrador</option>
                        </select>
                        <button type="submit" className="text-xs text-slate-500 underline hover:text-slate-900">
                          salvar
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {u.ativo === false ? (
                      <div>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                          Inativo
                        </span>
                        {u.ativo_alterado_em && (
                          <p className="mt-1 text-xs text-slate-500">
                            desde {new Date(u.ativo_alterado_em).toLocaleDateString("pt-BR")}
                            {u.ativo_alterado_por && nomePorId.get(u.ativo_alterado_por)
                              ? ` por ${nomePorId.get(u.ativo_alterado_por)}`
                              : ""}
                          </p>
                        )}
                        <form action={alterarStatusUsuario.bind(null, u.id)} className="mt-1">
                          <input type="hidden" name="ativo" value="true" />
                          <button type="submit" className="text-xs text-marca underline hover:text-marca-escuro">
                            reativar
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          Ativo
                        </span>
                        {u.id !== atual.id && (
                          <p className="mt-1">
                            <Link
                              href={`/usuarios?inativar=${u.id}`}
                              className="text-xs text-slate-500 underline hover:text-red-700"
                            >
                              inativar
                            </Link>
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Novo usuário</h2>

        {!chaveConfigurada && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Para criar usuários por aqui, adicione a chave <code>SUPABASE_SERVICE_ROLE_KEY</code> ao arquivo{" "}
            <code>.env.local</code> (Supabase → Project Settings → API → service_role) e reinicie o
            servidor. Essa chave é secreta: nunca a compartilhe nem a envie ao navegador.
          </p>
        )}

        <form action={criarUsuario} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Nome</label>
            <input name="nome" required className={CAMPO} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">E-mail</label>
            <input name="email" type="email" required className={CAMPO} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Senha inicial</label>
            <input name="senha" type="password" required minLength={6} autoComplete="new-password" className={CAMPO} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Perfil</label>
            <select name="perfil" defaultValue="analista" className={CAMPO}>
              <option value="analista">Analista</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-marca px-3 py-2 text-sm font-medium text-white hover:bg-marca-escuro"
          >
            Criar usuário
          </button>
        </form>
      </div>
    </div>
  );
}
