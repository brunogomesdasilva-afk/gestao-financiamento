import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Fotos do espelho de vendas e planilhas passam facilmente de 1 MB (limite padrão das Server Actions).
    serverActions: { bodySizeLimit: "10mb" },
  },
  // O gerador de PDF lê arquivos de fonte (.afm) da própria pasta dele; no Vercel é preciso
  // mantê-lo fora do pacote e incluir esses arquivos explicitamente.
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/relatorios/**": ["./node_modules/pdfkit/js/data/**"],
  },
};

export default nextConfig;
