import { exigirAdmin } from "@/lib/auth";
import { gerarExcelConsolidado } from "@/lib/relatorioExcel";
import { carregarConsolidado, filtrarConsolidado, lerFiltros } from "@/lib/relatorios";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  await exigirAdmin();

  const filtros = lerFiltros(Object.fromEntries(new URL(request.url).searchParams.entries()));
  const supabase = await createClient();
  const linhas = filtrarConsolidado(await carregarConsolidado(supabase, filtros.situacao), filtros);
  const arquivo = await gerarExcelConsolidado(linhas);

  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }).replace(/\//g, "-");
  return new Response(new Uint8Array(arquivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="relatorio-consolidado-${hoje}.xlsx"`,
    },
  });
}
