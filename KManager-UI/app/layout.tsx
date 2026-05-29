import type {Metadata} from 'next';
import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'KManager',
  description: '你的高级极简战网账号管理器',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="zh-CN" className={`${inter.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning className="font-sans font-medium antialiased bg-transparent overflow-hidden">
        {children}
      </body>
    </html>
  );
}
