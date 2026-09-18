import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PerfilAtual = {
  id: string;
  nome: string;
  perfil: "admin" | "analista";
};

export async function getPerfilAtual(): Promise<PerfilAtual | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("nome, perfil").eq("id", user.id).single();

  return {
    id: user.id,
    nome: data?.nome ?? user.email ?? "",
    perfil: data?.perfil === "admin" ? "admin" : "analista",
  };
}

export async function exigirAdmin(): Promise<PerfilAtual> {
  const atual = await getPerfilAtual();
  if (!atual) redirect("/login");
  if (atual.perfil !== "admin") redirect("/");
  return atual;
}
