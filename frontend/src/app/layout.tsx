import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "./providers";

export const metadata: Metadata = {
  title: "SolSensor — DePIN IoT Data on Solana",
  description:
    "Tokenized IoT sensor pools × HTTP 402 machine-to-machine micro-payments on Solana",
  icons: [
    { rel: 'icon', url: '/favicon.svg', type: 'image/svg+xml' },
    { rel: 'shortcut icon', url: '/favicon.svg', type: 'image/svg+xml' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
