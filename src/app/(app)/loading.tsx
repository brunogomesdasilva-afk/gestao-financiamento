// Aparece no lugar do conteúdo da página enquanto os dados dela ainda estão sendo buscados
// (troca de tela, filtro, etc.), para não parecer que o sistema travou.
export default function Carregando() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-400">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-marca" />
      <p className="text-sm">Carregando...</p>
    </div>
  );
}
