import Image from "next/image";
import type { ReactNode } from "react";

// Todos os relatórios terminam com o logo da empresa, no canto inferior direito.
export default function RelatoriosLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      {children}
      <div className="mt-10 flex justify-end border-t border-slate-200 pt-4">
        <Image
          src="/logo-credimoveis-fundo-claro.png"
          alt="Cred Imóveis"
          width={972}
          height={530}
          className="h-auto w-28"
        />
      </div>
    </div>
  );
}
