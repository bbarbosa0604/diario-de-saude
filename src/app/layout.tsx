import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meuintestino",
  description: "Entenda seus padrões com seus próprios registros.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
