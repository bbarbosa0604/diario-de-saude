import type { Metadata } from "next";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/service-worker-registration";

export const metadata: Metadata = {
  title: "Meu Intestino",
  description: "Entenda seus padrões com seus próprios registros.",
  icons: {
    icon: [{ url: "/meu-intestino-icon.png", type: "image/png" }],
    apple: "/meu-intestino-icon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col"><ServiceWorkerRegistration />{children}</body>
    </html>
  );
}
