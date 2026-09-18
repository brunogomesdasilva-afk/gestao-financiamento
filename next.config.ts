import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Fotos do espelho de vendas e planilhas passam facilmente de 1 MB (limite padrão das Server Actions).
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
