import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meu Intestino",
  description: "Entenda seus padrões com seus próprios registros.",
  icons: {
    icon: [{ url: "/logo-icon-reference.png", type: "image/png" }],
    apple: "/logo-icon-reference.png",
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
