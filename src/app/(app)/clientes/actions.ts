"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin, getPerfilAtual } from "@/lib/auth";
import { STATUS_VENDIDO } from "@/lib/database.types";
import { parseValorBR } from "@/lib/valores";

function parseValor(raw: FormDataEntryValue | null) {
  return parseValorBR(String(raw ?? ""));
}

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim() || null;
}

function dadosDoFormulario(formData: FormData) {
  return {
    nome: texto(formData, "nome"),
    cpf: texto(formData, "cpf"),
    telefone: texto(formData, "telefone"),
    email: texto(formData, "email"),
    banco_financiador: texto(formData, "banco_financiador"),
    agencia_financiamento: texto(formData, "agencia_financiamento")?.slice(0, 4) ?? null,
    modalidade_financiamento_id: texto(formData, "modalidade_financiamento_id"),
    valor_compra: parseValor(formData.get("valor_compra")),
    fgts_contratado: parseValor(formData.get("fgts_contratado")),
    financiamento_contratado: parseValor(formData.get("financiamento_contratado")),
    fgts_atualizacao: parseValor(formData.get("fgts_atualizacao")),
    valor_aprovado: parseValor(formData.get("valor_aprovado")),
    terreno: parseValor(formData.get("terreno")),
    seguro: texto(formData, "seguro"),
    escritura: texto(formData, "escritura"),
    validade: texto(formData, "validade"),
    observacoes: texto(formData, "observacoes"),
  };
}

async function empreendimentoIdDaUnidade(
  supabase: Awaited<ReturnType<typeof createClient>>,
  unidadeId: string
) {
  const { data } = await supabase
    .from("unidades")
    .select("torre_id, torres(empreendimento_id)")
    .eq("id", unidadeId)
    .single();
  const torres = data?.torres as unknown as { empreendimento_id: string } | null;
  return torres?.empreendimento_id ?? null;
}

// O administrador transfere (atribui) a análise de financiamento de uma unidade vendida a um
// analista. A exclusividade é garantida pelo banco (índice único de acompanhamento ativo por
// unidade), então duas atribuições ao mesmo tempo nunca ficam com a mesma unidade.
export async function assumirUnidade(formData: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const unidadeId = texto(formData, "unidade_id");
  const analistaId = texto(formData, "analista_id");

  if (!unidadeId) {
    redirect(`/clientes/novo?erro=${encodeURIComponent("Selecione o empreendimento, o bloco e a unidade.")}`);
  }
  if (!analistaId) {
    redirect(`/clientes/novo?unidade=${unidadeId}&erro=${encodeURIComponent("Escolha o analista responsável.")}`);
  }

  const { data: analista } = await supabase.from("profiles").select("id, ativo").eq("id", analistaId).single();
  if (!analista || analista.ativo === false) {
    redirect(`/clientes/novo?unidade=${unidadeId}&erro=${encodeURIComponent("Escolha um analista ativo.")}`);
  }

  const { data: unidade } = await supabase
    .from("unidades")
    .select("id, status")
    .eq("id", unidadeId)
    .single();
  if (!unidade || unidade.status !== STATUS_VENDIDO) {
    redirect(`/clientes/novo?erro=${encodeURIComponent(`Só é possível assumir unidades com status ${STATUS_VENDIDO}.`)}`);
  }

  let etapaId = texto(formData, "etapa_id");
  if (!etapaId) {
    const { data: primeiraEtapa } = await supabase
      .from("etapas")
      .select("id")
      .order("ordem", { ascending: true })
      .limit(1)
      .single();
    etapaId = primeiraEtapa?.id ?? null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cliente, error } = await supabase
    .from("clientes")
    .insert({
      ...dadosDoFormulario(formData),
      unidade_id: unidadeId,
      empreendimento_id: await empreendimentoIdDaUnidade(supabase, unidadeId),
      analista_responsavel_id: analistaId,
      etapa_atual_id: etapaId,
    })
    .select("id")
    .single();

  if (error || !cliente) {
    const mensagem =
      error?.code === "23505"
        ? "Essa unidade acabou de ser atribuída a outro analista."
        : (error?.message ?? "Erro ao transferir a unidade.");
    redirect(`/clientes/novo?unidade=${unidadeId}&erro=${encodeURIComponent(mensagem)}`);
  }

  await supabase.from("andamento_historico").insert({
    cliente_id: cliente.id,
    etapa_id: etapaId,
    observacao: "Unidade transferida para o analista pelo administrador",
    usuario_id: user.id,
  });

  revalidatePath("/");
  revalidatePath("/clientes");
  revalidatePath("/clientes/novo");
  redirect(`/clientes/${cliente.id}`);
}

export async function atualizarCliente(clienteId: string, formData: FormData) {
  const supabase = await createClient();
  const perfilAtual = await getPerfilAtual();
  if (!perfilAtual) redirect("/login");

  // O status (etapa) pode ser alterado aqui; quando muda, a troca fica registrada no histórico da unidade.
  const novaEtapaId = texto(formData, "etapa_id");
  const { data: atual } = await supabase
    .from("clientes")
    .select("etapa_atual_id")
    .eq("id", clienteId)
    .single();
  const mudouEtapa = Boolean(novaEtapaId) && novaEtapaId !== atual?.etapa_atual_id;

  // DISTRATO e REPASSADO só podem ser escolhidos (ou tirados) por um administrador.
  if (mudouEtapa && perfilAtual.perfil !== "admin") {
    const { data: etapasEnvolvidas } = await supabase
      .from("etapas")
      .select("id, restrita_admin")
      .in("id", [novaEtapaId, atual?.etapa_atual_id].filter((v): v is string => Boolean(v)));
    const restrita = (etapasEnvolvidas ?? []).some((e) => e.restrita_admin);
    if (restrita) {
      redirect(
        `/clientes/${clienteId}/editar?erro=${encodeURIComponent("Somente o administrador pode alterar esse status.")}`
      );
    }
  }

  const { error } = await supabase
    .from("clientes")
    .update({
      ...dadosDoFormulario(formData),
      ...(mudouEtapa ? { etapa_atual_id: novaEtapaId } : {}),
    })
    .eq("id", clienteId);

  if (error) {
    redirect(`/clientes/${clienteId}/editar?erro=${encodeURIComponent(error.message)}`);
  }

  if (mudouEtapa) {
    await registrarAcao(supabase, clienteId, novaEtapaId, "Status alterado na edição do cadastro");
  }

  revalidatePath("/");
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clienteId}`);
  redirect(`/clientes/${clienteId}`);
}

// Registra no histórico da unidade (aba "Andamento") uma ação feita sobre o acompanhamento do cliente.
async function registrarAcao(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clienteId: string,
  etapaId: string | null,
  observacao: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("andamento_historico").insert({
    cliente_id: clienteId,
    etapa_id: etapaId,
    observacao,
    usuario_id: user?.id ?? null,
  });
}

function revalidarCarteira(clienteId: string) {
  revalidatePath("/");
  revalidatePath("/clientes");
  revalidatePath("/clientes/novo");
  revalidatePath(`/clientes/${clienteId}`);
}

// Concluir (arquivado = true) libera a unidade para outro analista; reativar só funciona se
// ninguém tiver assumido a unidade nesse meio tempo.
export async function arquivarCliente(clienteId: string, arquivado: boolean) {
  const supabase = await createClient();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("etapa_atual_id")
    .eq("id", clienteId)
    .single();

  const { error } = await supabase.from("clientes").update({ arquivado }).eq("id", clienteId);

  if (error) {
    const mensagem =
      error.code === "23505"
        ? "Não é possível reativar: essa unidade já foi assumida por outro analista."
        : error.message;
    redirect(`/clientes/${clienteId}?erro=${encodeURIComponent(mensagem)}`);
  }

  await registrarAcao(
    supabase,
    clienteId,
    cliente?.etapa_atual_id ?? null,
    arquivado ? "Análise concluída e unidade liberada" : "Unidade reativada"
  );

  revalidarCarteira(clienteId);
}

// O analista devolve a unidade: ela sai da carteira dele e volta a ficar disponível, sem analista,
// para qualquer analista assumir. O cadastro e o histórico ficam guardados na unidade.
export async function devolverUnidade(clienteId: string) {
  const supabase = await createClient();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("etapa_atual_id, arquivado")
    .eq("id", clienteId)
    .single();
  if (!cliente || cliente.arquivado) {
    redirect(`/clientes?erro=${encodeURIComponent("Essa unidade não está mais na sua carteira.")}`);
  }

  const { error } = await supabase.from("clientes").update({ arquivado: true }).eq("id", clienteId);
  if (error) redirect(`/clientes?erro=${encodeURIComponent(error.message)}`);

  await registrarAcao(supabase, clienteId, cliente.etapa_atual_id, "Unidade devolvida à carteira sem analista");

  revalidarCarteira(clienteId);
  redirect(`/clientes?ok=${encodeURIComponent("Unidade devolvida. Ela ficou disponível para outro analista assumir.")}`);
}
