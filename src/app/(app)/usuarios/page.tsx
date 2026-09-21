import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/auth";
import type { Profile } from "@/lib/database.types";
import { alterarNomeUsuario, alterarPerfilUsuario, criarUsuario } from "./actions";

const CAMPO = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const ROTULO_PERFIL = { admin: "Administrador", analista: "Analista" } as const;

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const atual = await exigirAdmin();
  const { erro, ok } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("nome");
  const usuarios = (data ?? []) as Profile[];
  const chaveConfigurada = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

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

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">E-mail</th>
                <th className="px-4 py-2 font-medium">Perfil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios.map((u) => (
                <tr key={u.id}>
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
