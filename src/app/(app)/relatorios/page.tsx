import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";

const RELATORIOS = [
  {
    href: "/relatorios/consolidado",
    titulo: "Relatório consolidado",
    descricao:
      "Uma linha por unidade com toda a última informação cadastrada. Filtre por empreendimento, bloco, unidade, analista e status; exporte em Excel ou envie por e-mail.",
  },
  {
    href: "/relatorios/dash",
    titulo: "Dash por empreendimento",
    descricao:
      "Fechamento de cada empreendimento: quantas unidades estão em cada status, tanto no espelho de vendas quanto na análise de financiamento.",
  },
  {
    href: "/relatorios/meta",
    titulo: "Relatório de meta",
    descricao: "Quantas unidades cada analista tem, por empreendimento e por status.",
  },
];

export default async function RelatoriosPage() {
  await exigirAdmin();

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Relatórios</h1>
      <p className="mt-1 text-sm text-slate-500">Escolha o relatório.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {RELATORIOS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-400"
          >
            <h2 className="text-sm font-semibold text-slate-900">{r.titulo}</h2>
            <p className="mt-2 text-sm text-slate-500">{r.descricao}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
