"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PERFIS = ["admin", "analista"];

function voltar(params: Record<string, string>): never {
  redirect(`/usuarios?${new URLSearchParams(params).toString()}`);
}

export async function criarUsuario(formData: FormData) {
  await exigirAdmin();

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const perfil = String(formData.get("perfil") ?? "analista");

  if (!nome || !email) voltar({ erro: "Informe o nome e o e-mail." });
  if (senha.length < 6) voltar({ erro: "A senha precisa ter pelo menos 6 caracteres." });
  if (!PERFIS.includes(perfil)) voltar({ erro: "Perfil inválido." });

  const admin = createAdminClient();
  if (!admin) {
    voltar({ erro: "Chave de serviço do Supabase não configurada (SUPABASE_SERVICE_ROLE_KEY)." });
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (error || !data.user) {
    const jaExiste = error?.message.toLowerCase().includes("already");
    voltar({ erro: jaExiste ? "Já existe um usuário com esse e-mail." : (error?.message ?? "Erro ao criar o usuário.") });
  }

  // O perfil (linha em profiles) é criado por um gatilho do banco com o perfil padrão "analista".
  const { error: erroPerfil } = await admin.from("profiles").update({ perfil }).eq("id", data.user.id);
  if (erroPerfil) voltar({ erro: erroPerfil.message });

  revalidatePath("/usuarios");
  voltar({ ok: `Usuário ${nome} criado.` });
}

// O nome é o que aparece nos históricos, na carteira e no painel (no lugar do e-mail).
export async function alterarNomeUsuario(usuarioId: string, formData: FormData) {
  await exigirAdmin();
  const nome = String(formData.get("nome") ?? "").trim().slice(0, 80);
  if (!nome) voltar({ erro: "Informe o nome." });

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ nome }).eq("id", usuarioId);
  if (error) voltar({ erro: error.message });

  revalidatePath("/", "layout");
  voltar({ ok: "Nome atualizado." });
}

export async function alterarPerfilUsuario(usuarioId: string, formData: FormData) {
  const atual = await exigirAdmin();
  const perfil = String(formData.get("perfil") ?? "");

  if (usuarioId === atual.id) voltar({ erro: "Você não pode alterar o seu próprio perfil." });
  if (!PERFIS.includes(perfil)) voltar({ erro: "Perfil inválido." });

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ perfil }).eq("id", usuarioId);
  if (error) voltar({ erro: error.message });

  revalidatePath("/usuarios");
  voltar({ ok: "Perfil atualizado." });
}
