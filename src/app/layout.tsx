
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DUDSHOP777",
  description: "DUDSHOP777 Key Store",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
