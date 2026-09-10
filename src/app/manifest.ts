import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Plantcor C66 Scanner Terminal",
    short_name: "C66 Scanner",
    description: "Control-Access RFID & Barcode Handheld Scanner Terminal",
    start_url: "/scanner",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#007AFF",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
