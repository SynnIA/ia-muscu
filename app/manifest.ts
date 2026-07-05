import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "La Forge",
    short_name: "La Forge",
    description: "Ton coach personnel musculation & nutrition",
    start_url: "/journal",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    lang: "fr",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
