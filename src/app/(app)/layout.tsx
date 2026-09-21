import Image from "next/image";
import { cookies } from "next/headers";
import { getPerfilAtual } from "@/lib/auth";
import { Sidebar } from "./Sidebar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const atual = await getPerfilAtual();
  const cookieStore = await cookies();
  const recolhido = cookieStore.get("sidebar_recolhido")?.value === "1";
  const submenusAbertos = decodeURIComponent(cookieStore.get("submenus_abertos")?.value ?? "")
    .split(",")
    .filter(Boolean);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        nome={atual?.nome ?? ""}
        perfil={atual?.perfil ?? "analista"}
        recolhidoInicial={recolhido}
        submenusIniciais={submenusAbertos}
      />
      <main className="min-w-0 flex-1 px-6 py-6">
        <div className="mb-2 flex justify-end">
          <Image
            src="/logo-credimoveis-fundo-claro.png"
            alt="Cred Imóveis"
            width={972}
            height={530}
            className="h-auto w-24"
            priority
          />
        </div>
        {children}
      </main>
    </div>
  );
}
