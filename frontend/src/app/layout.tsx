import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/lib/toast';
import ToastContainer from '@/components/ToastContainer';

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "AromaSys",
  description: "Next-generation digital inventory and organic aroma batch telemetry tracking platform.",
  icons: {
    icon: "/logo-cerah.png",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body 
        className={`${poppins.variable} font-sans antialiased bg-[#D7E5D8] text-[#1C1B1F] min-h-screen relative`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <ToastProvider>
            {children}
            <ToastContainer />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
