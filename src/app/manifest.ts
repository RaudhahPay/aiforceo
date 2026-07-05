import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AIforCEO",
    short_name: "AIforCEO",
    description:
      "Six AI Command Executives briefed on your business in 30 minutes.",
    start_url: "/command",
    display: "standalone",
    background_color: "#0E1726",
    theme_color: "#F0B429",
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
