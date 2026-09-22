"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Barra de carregamento no topo da tela: aparece assim que o usuário clica em um link ou envia um
// formulário (inclusive os que chamam uma ação do servidor), e some quando a navegação termina.
// Sem isso, uma consulta um pouco mais lenta no Supabase passa a impressão de que o sistema travou.
export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [andamento, setAndamento] = useState(0); // 0 = escondida
  const tempoLimite = useRef<ReturnType<typeof setTimeout> | null>(null);

  function iniciar() {
    if (tempoLimite.current) clearTimeout(tempoLimite.current);
    setAndamento(80);
    // Trava de segurança: nunca fica presa na tela, mesmo numa navegação que não muda a URL.
    tempoLimite.current = setTimeout(() => setAndamento(0), 8000);
  }

  useEffect(() => {
    function aoClicar(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const link = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const destino = link.getAttribute("href") ?? "";
      if (!destino.startsWith("/")) return; // só navegação interna
      const atual = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      if (destino === atual) return;
      iniciar();
    }
    function aoEnviarFormulario() {
      // Cobre os formulários que chamam uma ação do servidor (a maioria do sistema).
      iniciar();
    }
    document.addEventListener("click", aoClicar);
    document.addEventListener("submit", aoEnviarFormulario);
    return () => {
      document.removeEventListener("click", aoClicar);
      document.removeEventListener("submit", aoEnviarFormulario);
    };
  }, [pathname, searchParams]);

  // A URL efetiva mudou: a navegação (ou o redirecionamento da ação) terminou.
  useEffect(() => {
    if (andamento === 0) return;
    const conclusao = requestAnimationFrame(() => setAndamento(100));
    const escondida = setTimeout(() => setAndamento(0), 200);
    return () => {
      cancelAnimationFrame(conclusao);
      clearTimeout(escondida);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (andamento === 0) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] h-0.5 bg-transparent" aria-hidden="true">
      <div
        className="h-full bg-marca-claro shadow-[0_0_8px_var(--color-marca-claro)] transition-all ease-out"
        style={{ width: `${andamento}%`, transitionDuration: andamento === 100 ? "150ms" : "600ms" }}
      />
    </div>
  );
}
