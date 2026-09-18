"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Menu de três pontos de cada unidade da carteira. Fica em posição fixa para não ser cortado
// pela rolagem da tabela.
export function MenuAcoesUnidade({
  clienteId,
  devolverAction,
}: {
  clienteId: string;
  devolverAction: () => Promise<void>;
}) {
  const botao = useRef<HTMLButtonElement>(null);
  const [posicao, setPosicao] = useState<{ topo: number; direita: number } | null>(null);

  function alternar() {
    if (posicao) {
      setPosicao(null);
      return;
    }
    const r = botao.current?.getBoundingClientRect();
    if (r) setPosicao({ topo: r.bottom + 4, direita: Math.max(8, window.innerWidth - r.right) });
  }

  useEffect(() => {
    if (!posicao) return;
    const fechar = () => setPosicao(null);
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPosicao(null);
    };
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    window.addEventListener("keydown", aoTeclar);
    return () => {
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [posicao]);

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={alternar}
        aria-label="Ações da unidade"
        aria-haspopup="menu"
        aria-expanded={posicao !== null}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {posicao && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPosicao(null)} />
          <div
            role="menu"
            className="fixed z-50 w-64 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            style={{ top: posicao.topo, right: posicao.direita }}
          >
            <Link
              href={`/clientes/${clienteId}/editar`}
              role="menuitem"
              className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Alterar cadastro da unidade
            </Link>
            <form action={devolverAction}>
              <button
                type="submit"
                role="menuitem"
                onClick={(e) => {
                  if (
                    !window.confirm(
                      "Devolver esta unidade à carteira sem analista? Ela sai da sua carteira e fica disponível para outro analista assumir."
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
                className="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
              >
                Devolver unidade à carteira sem analista
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );
}
