import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Using Inter as requested (or standard)
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "AdNext - Automação Messenger",
    description: "Plataforma de automação premium para Messenger",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="pt-BR" className="dark">
            <body className={inter.className}>
                {children}
                <Toaster />
            </body>
        </html>
    );
}
