import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Boardroom AI",
    short_name: "Boardroom AI",
    description: "Your AI C-Suite — 6 executives customized for your business",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0E1726",
    theme_color: "#C5A572",
    orientation: "portrait-primary",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [],
    shortcuts: [
      {
        name: "Open Aria",
        short_name: "Aria",
        description: "Chat with your AI Chief of Staff",
        url: "/agent/aria",
        icons: [{ src: "/icon.svg", sizes: "any" }],
      },
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "Command Centre",
        url: "/dashboard",
        icons: [{ src: "/icon.svg", sizes: "any" }],
      },
    ],
  };
}
