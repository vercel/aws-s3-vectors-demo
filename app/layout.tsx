import type { Metadata } from "next";
import "./globals.css";
import { Geist_Mono } from "next/font/google";

export const metadata: Metadata = {
  title: "S3 Vectors Movies Demo",
  description:
    "Describe a movie and find it by meaning, using Amazon S3 Vectors.",
};

const geist = Geist_Mono({
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.className} antialiased bg-white dark:bg-black`}>
        {children}
      </body>
    </html>
  );
}
