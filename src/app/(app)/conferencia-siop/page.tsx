import Link from "next/link";

export default function ConferenciaSiopPage() {
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Conferência SIOP</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Compara os valores do item <strong>5 - Valores da operação</strong> do PDF do SIOP com o cadastro
            de cada unidade no sistema: valor de compra e venda, valor do financiamento, FGTS e terreno.
          </p>
        </div>
        <Link
          href="/conferencia-siop/nova"
          className="shrink-0 rounded-md bg-marca px-4 py-2 text-sm font-medium text-white hover:bg-marca-escuro"
        >
          Conferência
        </Link>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        <h2 className="text-sm font-semibold text-slate-900">Como funciona</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Você escolhe o empreendimento e o sistema abre a pasta dele dentro da pasta <strong>SIOP</strong>.</li>
          <li>
            Para cada unidade cadastrada, procura o PDF <strong>SIOP - Unidade - Torre</strong> (ex.:{" "}
            <em>SIOPI - 103 - A.pdf</em>). Espaços a mais não atrapalham, e <strong>Bloco 1</strong> equivale a{" "}
            <strong>Torre A</strong>, <strong>Bloco 2</strong> a <strong>Torre B</strong>, e assim por diante.
          </li>
          <li>
            Mostra o que confere, o que diverge e as unidades que ainda não têm PDF na pasta. Só entram as
            unidades que estão em carteira e que você pode ver.
          </li>
        </ul>
      </div>
    </div>
  );
}
