import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meu Intestino",
    short_name: "Meu Intestino",
    description: "Registre seu dia e entenda seus padrões intestinais.",
    start_url: "/",
    display: "standalone",
    background_color: "#fcfcf9",
    theme_color: "#1e6341",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
