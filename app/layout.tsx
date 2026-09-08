import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '企见 · 企业红黑榜',
  description:
    '从一份工作，到一件产品。共同记录企业工时，了解产品背后的供应商。',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
