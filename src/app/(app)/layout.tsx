import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";

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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-sm font-semibold text-slate-900">
              Gestão de Financiamento
            </Link>
            <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
              Clientes
            </Link>
            <Link href="/clientes/novo" className="text-sm text-slate-600 hover:text-slate-900">
              Assumir unidade
            </Link>
            <Link href="/empreendimentos" className="text-sm text-slate-600 hover:text-slate-900">
              Empreendimentos
            </Link>
            <Link href="/empreendimentos/importar" className="text-sm text-slate-600 hover:text-slate-900">
              Cadastrar empreendimento
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">{nome}</span>
            <form action={logout}>
              <button className="text-sm text-slate-500 hover:text-slate-900" type="submit">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
