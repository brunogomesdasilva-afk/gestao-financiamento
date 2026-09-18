import { cookies } from "next/headers";
import { getPerfilAtual } from "@/lib/auth";
import { Sidebar } from "./Sidebar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const atual = await getPerfilAtual();
  const cookieStore = await cookies();
  const recolhido = cookieStore.get("sidebar_recolhido")?.value === "1";
  const submenuAberto = cookieStore.get("submenu_empreendimentos")?.value === "1";

  return (
    <div className="flex min-h-screen">
      <Sidebar
        nome={atual?.nome ?? ""}
        perfil={atual?.perfil ?? "analista"}
        recolhidoInicial={recolhido}
        submenuInicial={submenuAberto}
      />
      <main className="min-w-0 flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
