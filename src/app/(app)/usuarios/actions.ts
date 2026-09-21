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

// O e-mail é o login do usuário: troca no Supabase Auth (precisa da chave de serviço) e no perfil.
export async function alterarEmailUsuario(usuarioId: string, formData: FormData) {
  await exigirAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) voltar({ erro: "Informe um e-mail válido.", editarEmail: usuarioId });

  const admin = createAdminClient();
  if (!admin) {
    voltar({
      erro: "Chave de serviço do Supabase não configurada (SUPABASE_SERVICE_ROLE_KEY).",
      editarEmail: usuarioId,
    });
  }

  const { error } = await admin.auth.admin.updateUserById(usuarioId, { email, email_confirm: true });
  if (error) {
    const jaExiste = /already|registered|exists/i.test(error.message);
    voltar({
      erro: jaExiste ? "Já existe um usuário com esse e-mail." : error.message,
      editarEmail: usuarioId,
    });
  }

  const { error: erroPerfil } = await admin.from("profiles").update({ email }).eq("id", usuarioId);
  if (erroPerfil) voltar({ erro: erroPerfil.message });

  revalidatePath("/usuarios");
  voltar({ ok: "E-mail atualizado. O usuário passa a entrar com o novo e-mail." });
}

// Ativa ou inativa um usuário (nunca exclui, para preservar o histórico). Ao inativar, as unidades
// em andamento dele são transferidas ao analista escolhido, e cada transferência fica registrada
// no histórico da unidade com o nome do administrador que fez a alteração.
export async function alterarStatusUsuario(usuarioId: string, formData: FormData) {
  const atual = await exigirAdmin();
  const ativar = String(formData.get("ativo") ?? "") === "true";
  const destinoId = String(formData.get("destino") ?? "");

  if (usuarioId === atual.id) voltar({ erro: "Você não pode inativar o seu próprio usuário." });

  const supabase = await createClient();
  const { data: alvo } = await supabase.from("profiles").select("id, nome").eq("id", usuarioId).single();
  if (!alvo) voltar({ erro: "Usuário não encontrado." });

  if (!ativar) {
    const { data: carteira } = await supabase
      .from("clientes")
      .select("id, etapa_atual_id")
      .eq("analista_responsavel_id", usuarioId)
      .eq("arquivado", false);
    const clientes = carteira ?? [];

    if (clientes.length > 0) {
      if (!destinoId || destinoId === usuarioId) {
        voltar({ erro: "Escolha para quem enviar as unidades deste usuário.", inativar: usuarioId });
      }
      const { data: destino } = await supabase
        .from("profiles")
        .select("id, nome, ativo")
        .eq("id", destinoId)
        .single();
      if (!destino || destino.ativo === false) {
        voltar({ erro: "O usuário de destino precisa estar ativo.", inativar: usuarioId });
      }

      const { error: erroTransf } = await supabase
        .from("clientes")
        .update({ analista_responsavel_id: destinoId })
        .eq("analista_responsavel_id", usuarioId)
        .eq("arquivado", false);
      if (erroTransf) voltar({ erro: erroTransf.message, inativar: usuarioId });

      const observacao = `Unidade transferida de ${alvo.nome} para ${destino.nome}: ${alvo.nome} foi inativado por ${atual.nome}.`;
      await supabase.from("andamento_historico").insert(
        clientes.map((c) => ({
          cliente_id: c.id,
          etapa_id: c.etapa_atual_id,
          observacao,
          usuario_id: atual.id,
        }))
      );
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ ativo: ativar, ativo_alterado_em: new Date().toISOString(), ativo_alterado_por: atual.id })
    .eq("id", usuarioId);
  if (error) voltar({ erro: error.message });

  // Bloqueia também no Supabase Auth (encerra sessões e impede novo login), se a chave estiver configurada.
  const admin = createAdminClient();
  if (admin) {
    await admin.auth.admin.updateUserById(usuarioId, { ban_duration: ativar ? "none" : "876000h" });
  }

  revalidatePath("/", "layout");
  voltar({ ok: ativar ? `${alvo.nome} foi reativado.` : `${alvo.nome} foi inativado.` });
}
