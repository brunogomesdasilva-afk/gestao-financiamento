"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { logout } from "@/app/login/actions";

function Icone({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

type ItemMenu = {
  href: string;
  rotulo: string;
  somenteAdmin?: boolean;
  ativo: (pathname: string) => boolean;
  icone: ReactNode;
  filhos?: ItemMenu[];
};

const ITENS: ItemMenu[] = [
  {
    href: "/empreendimentos",
    rotulo: "Cadastrar empreendimento",
    somenteAdmin: true,
    ativo: (p: string) =>
      p === "/empreendimentos" ||
      (p.startsWith("/empreendimentos/") &&
        p !== "/empreendimentos/importar" &&
        p !== "/empreendimentos/atualizar-espelho"),
    icone: (
      <Icone>
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M9 22v-4h6v4" />
        <path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
      </Icone>
    ),
    filhos: [
      {
        href: "/empreendimentos/importar",
        rotulo: "Cadastrar novo empreendimento",
        ativo: (p: string) => p === "/empreendimentos/importar",
        icone: (
          <Icone>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </Icone>
        ),
      },
      {
        href: "/empreendimentos/atualizar-espelho",
        rotulo: "Atualizar espelho de vendas",
        ativo: (p: string) => p === "/empreendimentos/atualizar-espelho",
        icone: (
          <Icone>
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </Icone>
        ),
      },
    ],
  },
  {
    href: "/clientes",
    rotulo: "Assumir unidade",
    ativo: (p: string) => p === "/clientes" || p === "/clientes/novo",
    icone: (
      <Icone>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <polyline points="9 14 11 16 15 12" />
      </Icone>
    ),
  },
  {
    href: "/",
    rotulo: "Painel",
    ativo: (p: string) => p === "/" || (p.startsWith("/clientes/") && p !== "/clientes/novo"),
    icone: (
      <Icone>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </Icone>
    ),
  },
  {
    href: "/usuarios",
    rotulo: "Usuários",
    somenteAdmin: true,
    ativo: (p: string) => p === "/usuarios",
    icone: (
      <Icone>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </Icone>
    ),
  },
];

function LinkMenu({
  item,
  pathname,
  recolhido,
  filho,
}: {
  item: ItemMenu;
  pathname: string;
  recolhido: boolean;
  filho?: boolean;
}) {
  const ativo = item.ativo(pathname);
  return (
    <Link
      href={item.href}
      title={recolhido ? item.rotulo : undefined}
      aria-label={item.rotulo}
      aria-current={ativo ? "page" : undefined}
      className={`flex items-center gap-3 rounded-md px-3 py-2 ${filho && !recolhido ? "text-[13px]" : "text-sm"} ${
        recolhido ? "justify-center" : ""
      } ${
        ativo
          ? "bg-slate-100 font-medium text-slate-900"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {item.icone}
      {!recolhido && <span className={filho ? "leading-tight" : "truncate"}>{item.rotulo}</span>}
    </Link>
  );
}

export function Sidebar({
  nome,
  perfil,
  recolhidoInicial,
}: {
  nome: string;
  perfil: "admin" | "analista";
  recolhidoInicial: boolean;
}) {
  const pathname = usePathname();
  const [recolhido, setRecolhido] = useState(recolhidoInicial);

  function alternar() {
    const proximo = !recolhido;
    setRecolhido(proximo);
    document.cookie = `sidebar_recolhido=${proximo ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ${
        recolhido ? "w-16" : "w-72"
      }`}
    >
      <div className={`flex h-14 items-center border-b border-slate-200 ${recolhido ? "justify-center" : "justify-between px-4"}`}>
        {!recolhido && (
          <span className="truncate text-sm font-semibold text-slate-900">Gestão de Financiamento</span>
        )}
        <button
          type="button"
          onClick={alternar}
          aria-expanded={!recolhido}
          aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
          title={recolhido ? "Expandir menu" : "Recolher menu"}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <Icone>
            {recolhido ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
          </Icone>
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {ITENS.filter((item) => !item.somenteAdmin || perfil === "admin").map((item) => (
          <div key={item.href} className="space-y-1">
            <LinkMenu item={item} pathname={pathname} recolhido={recolhido} />
            {item.filhos && (
              <div className={recolhido ? "space-y-1" : "ml-5 space-y-1 border-l border-slate-200 pl-2"}>
                {item.filhos.map((filho) => (
                  <LinkMenu key={filho.href} item={filho} pathname={pathname} recolhido={recolhido} filho />
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-2">
        {!recolhido && (
          <p className="truncate px-3 py-1 text-xs text-slate-500">
            {nome}
            {perfil === "admin" ? " · administrador" : ""}
          </p>
        )}
        <form action={logout}>
          <button
            type="submit"
            title={recolhido ? "Sair" : undefined}
            aria-label="Sair"
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 ${
              recolhido ? "justify-center" : ""
            }`}
          >
            <Icone>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </Icone>
            {!recolhido && <span>Sair</span>}
          </button>
        </form>
      </div>
    </aside>
  );
}
