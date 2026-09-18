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

const ITENS = [
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
    href: "/clientes/novo",
    rotulo: "Assumir unidade",
    ativo: (p: string) => p === "/clientes/novo",
    icone: (
      <Icone>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <polyline points="9 14 11 16 15 12" />
      </Icone>
    ),
  },
  {
    href: "/empreendimentos",
    rotulo: "Empreendimentos",
    ativo: (p: string) =>
      p === "/empreendimentos" ||
      (p.startsWith("/empreendimentos/") && p !== "/empreendimentos/importar"),
    icone: (
      <Icone>
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M9 22v-4h6v4" />
        <path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
      </Icone>
    ),
  },
  {
    href: "/empreendimentos/importar",
    rotulo: "Cadastrar empreendimento",
    ativo: (p: string) => p === "/empreendimentos/importar",
    icone: (
      <Icone>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </Icone>
    ),
  },
];

export function Sidebar({
  nome,
  recolhidoInicial,
}: {
  nome: string;
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
        recolhido ? "w-16" : "w-64"
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
        {ITENS.map((item) => {
          const ativo = item.ativo(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={recolhido ? item.rotulo : undefined}
              aria-label={item.rotulo}
              aria-current={ativo ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                recolhido ? "justify-center" : ""
              } ${
                ativo
                  ? "bg-slate-100 font-medium text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {item.icone}
              {!recolhido && <span className="truncate">{item.rotulo}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-2">
        {!recolhido && <p className="truncate px-3 py-1 text-xs text-slate-500">{nome}</p>}
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
