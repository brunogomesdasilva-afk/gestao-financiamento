import Image from "next/image";

// Aparece no lugar do conteúdo da página enquanto os dados dela ainda estão sendo buscados
// (troca de tela, filtro, etc.), para não parecer que o sistema travou.
export default function Carregando() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-400">
      <div className="relative h-14 w-14">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-slate-200 border-t-marca" />
        <Image
          src="/logo-icone-fundo-claro.png"
          alt=""
          width={357}
          height={337}
          className="absolute inset-0 m-auto h-6 w-auto"
        />
      </div>
      <p className="text-sm">Carregando...</p>
    </div>
  );
}
