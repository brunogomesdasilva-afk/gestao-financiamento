import Image from "next/image";

export default function Carregando() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-grafite-escuro">
      <div className="relative h-14 w-14">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-white/20 border-t-marca-claro" />
        <Image src="/logo-icone.png" alt="" width={357} height={337} className="absolute inset-0 m-auto h-6 w-auto" />
      </div>
    </div>
  );
}
