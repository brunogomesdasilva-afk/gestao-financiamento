import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "./Sidebar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let nome = user?.email ?? "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", user.id)
      .single();
    if (profile?.nome) nome = profile.nome;
  }

  const recolhido = (await cookies()).get("sidebar_recolhido")?.value === "1";

  return (
    <div className="flex min-h-screen">
      <Sidebar nome={nome} recolhidoInicial={recolhido} />
      <main className="min-w-0 flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
