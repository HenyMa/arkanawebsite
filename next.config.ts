import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Add your image host here once you upload real product photography,
      // e.g. { protocol: "https", hostname: "your-project.supabase.co" }
    ],
  },
};

export default nextConfig;
