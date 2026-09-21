import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { cadastrarEmpreendimentoPorExcel } from "../actions";

export default async function CadastrarEmpreendimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await exigirAdmin();
  const { erro } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/empreendimentos" className="text-xs text-slate-500 hover:text-slate-900">
        ← Empreendimentos cadastrados
      </Link>
      <h1 className="mt-1 text-lg font-semibold text-slate-900">Cadastrar novo empreendimento</h1>
      <p className="mt-1 text-sm text-slate-500">
        Escolha a planilha do empreendimento (pasta <strong>Empreendimentos</strong>). O sistema cria o
        empreendimento, as torres e todas as unidades de uma vez.
      </p>

      {erro && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      <form
        action={cadastrarEmpreendimentoPorExcel}
        className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700">Planilha (.xlsx)</label>
          <input type="file" name="arquivo" accept=".xlsx,.xltx" required className="mt-1 w-full text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Nome do empreendimento</label>
          <input
            name="nome"
            placeholder="Deixe em branco para usar o nome do arquivo"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-marca px-3 py-2 text-sm font-medium text-white hover:bg-marca-escuro"
        >
          Cadastrar
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        <h2 className="text-sm font-semibold text-slate-900">Como a planilha deve ser</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Uma coluna <strong>Unidade</strong> (número do apartamento) e uma coluna <strong>Bloco</strong>{" "}
            (ou <strong>Torre</strong>), na primeira aba.
          </li>
          <li>Linhas repetidas de mesma unidade e bloco são ignoradas.</li>
          <li>
            As unidades entram com status <strong>Não informado</strong>; o status real vem depois, ao
            importar o espelho de vendas colorido.
          </li>
          <li>
            Se o empreendimento já existir (mesmo nome), só as unidades que faltam são acrescentadas —
            nada do que já está cadastrado é alterado.
          </li>
        </ul>
      </div>
    </div>
  );
}
