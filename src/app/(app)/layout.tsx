import { cookies } from "next/headers";
import { getPerfilAtual } from "@/lib/auth";
import { Sidebar } from "./Sidebar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const atual = await getPerfilAtual();
  const recolhido = (await cookies()).get("sidebar_recolhido")?.value === "1";

  return (
    <div className="flex min-h-screen">
      <Sidebar
        nome={atual?.nome ?? ""}
        perfil={atual?.perfil ?? "analista"}
        recolhidoInicial={recolhido}
      />
      <main className="min-w-0 flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
