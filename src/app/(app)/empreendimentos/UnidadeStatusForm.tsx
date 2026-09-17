"use client";

const STATUS_LABEL: Record<string, string> = {
  VENDIDA: "Vendida",
  DISPONIVEL: "Disponível",
  RESERVADA: "Reservada",
  BLOQUEADA: "Bloqueada",
  PERMUTA: "Permuta",
};

export function UnidadeStatusForm({
  status,
  action,
}: {
  status: string;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action}>
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="bg-transparent text-[11px] focus:outline-none"
      >
        {Object.entries(STATUS_LABEL).map(([valor, label]) => (
          <option key={valor} value={valor}>
            {label}
          </option>
        ))}
      </select>
    </form>
  );
}
