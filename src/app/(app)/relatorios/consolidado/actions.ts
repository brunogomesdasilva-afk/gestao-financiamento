"use server";

import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import { gerarExcelConsolidado } from "@/lib/relatorioExcel";
import { gerarPdfConsolidado } from "@/lib/relatorioPdf";
import { carregarConsolidado, filtrarConsolidado, filtrosParaParams, lerFiltros } from "@/lib/relatorios";
import { createClient } from "@/lib/supabase/server";

const PADRAO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAXIMO_DESTINATARIOS = 10;

export async function enviarConsolidadoPorEmail(formData: FormData) {
  await exigirAdmin();

  const filtros = lerFiltros(
    Object.fromEntries(Array.from(formData.entries()).map(([chave, valor]) => [chave, String(valor)]))
  );

  function voltar(mensagem: { erro?: string; ok?: string }): never {
    const params = filtrosParaParams(filtros);
    if (mensagem.erro) params.set("erro", mensagem.erro);
    if (mensagem.ok) params.set("ok", mensagem.ok);
    redirect(`/relatorios/consolidado?${params.toString()}`);
  }

  const destinatarios = Array.from(
    new Set(
      String(formData.get("destinatarios") ?? "")
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  if (destinatarios.length === 0) voltar({ erro: "Informe pelo menos um e-mail de destino." });
  if (destinatarios.length > MAXIMO_DESTINATARIOS) {
    voltar({ erro: `Informe no máximo ${MAXIMO_DESTINATARIOS} destinatários por envio.` });
  }
  const invalido = destinatarios.find((e) => !PADRAO_EMAIL.test(e));
  if (invalido) voltar({ erro: `E-mail inválido: ${invalido}` });

  if (!emailConfigurado()) {
    voltar({ erro: "O envio por e-mail ainda não foi configurado (variáveis SMTP no .env.local)." });
  }

  const supabase = await createClient();
  const linhas = filtrarConsolidado(await carregarConsolidado(supabase, filtros.situacao), filtros);
  if (linhas.length === 0) voltar({ erro: "Não há unidades para enviar com esses filtros." });

  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const nomeBase = `relatorio-consolidado-${hoje.replace(/\//g, "-")}`;
  const [excel, pdf] = await Promise.all([gerarExcelConsolidado(linhas), gerarPdfConsolidado(linhas)]);

  try {
    await enviarEmail({
      para: destinatarios,
      assunto: `Relatório consolidado de financiamentos - ${hoje}`,
      texto: `Segue em anexo o relatório consolidado de financiamentos gerado em ${hoje}, com ${linhas.length} unidade(s).`,
      anexos: [
        { nome: `${nomeBase}.xlsx`, conteudo: excel },
        { nome: `${nomeBase}.pdf`, conteudo: pdf },
      ],
    });
  } catch (e) {
    voltar({ erro: `Não foi possível enviar o e-mail: ${e instanceof Error ? e.message : "erro desconhecido"}` });
  }

  voltar({ ok: `Relatório enviado para ${destinatarios.join(", ")}.` });
}
