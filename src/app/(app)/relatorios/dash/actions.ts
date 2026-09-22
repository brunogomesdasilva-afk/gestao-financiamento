"use server";

import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import { gerarExcelDash } from "@/lib/relatorioExcel";
import { gerarPdfDash } from "@/lib/relatorioPdf";
import { carregarDash, MESES } from "@/lib/relatorios";
import { createClient } from "@/lib/supabase/server";

const PADRAO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAXIMO_DESTINATARIOS = 10;

export async function enviarDashPorEmail(formData: FormData) {
  await exigirAdmin();

  const mes = String(formData.get("mes") ?? "") || null;
  const ano = String(formData.get("ano") ?? "") || null;
  const empreendimentoId = String(formData.get("empreendimento") ?? "") || null;

  function voltar(mensagem: { erro?: string; ok?: string }): never {
    const params = new URLSearchParams();
    if (mes) params.set("mes", mes);
    if (ano) params.set("ano", ano);
    if (empreendimentoId) params.set("empreendimento", empreendimentoId);
    if (mensagem.erro) params.set("erro", mensagem.erro);
    if (mensagem.ok) params.set("ok", mensagem.ok);
    redirect(`/relatorios/dash?${params.toString()}`);
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
  const periodo = mes || ano ? { mes: mes ? Number(mes) : null, ano: ano ? Number(ano) : null } : undefined;
  let empreendimentos = await carregarDash(supabase, periodo);
  if (empreendimentoId) empreendimentos = empreendimentos.filter((e) => e.id === empreendimentoId);
  if (empreendimentos.length === 0) voltar({ erro: "Não há dados para enviar com esses filtros." });

  const rotuloPeriodo = mes || ano ? `${mes ? MESES[Number(mes) - 1] : "Todos os meses"}-${ano ?? "Todos os anos"}` : "Situação atual";
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const nomeBase = `dash-empreendimentos-${hoje.replace(/\//g, "-")}`;
  const [excel, pdf] = await Promise.all([
    gerarExcelDash(empreendimentos, rotuloPeriodo),
    gerarPdfDash(empreendimentos, rotuloPeriodo),
  ]);

  try {
    await enviarEmail({
      para: destinatarios,
      assunto: `Dash por empreendimento - ${hoje}`,
      texto: `Segue em anexo o dash por empreendimento gerado em ${hoje}, com ${empreendimentos.length} empreendimento(s).`,
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
