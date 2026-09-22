import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['cyrillic', 'latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://splitpace-run-analysis.lerakonyushenko.chatgpt.site'),
  title: 'Splitpace — анализ темпа бегуна',
  description: 'Интерактивный анализ сплитов, темпа и результата забега.',
  openGraph: {
    title: 'Splitpace — анализ темпа бегуна',
    description: 'Интерактивный анализ сплитов, темпа и результата забега.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Splitpace — анализ темпа бегуна' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Splitpace — анализ темпа бегуна',
    description: 'Интерактивный анализ сплитов, темпа и результата забега.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className={`${manrope.variable} antialiased`}>{children}</body>
    </html>
  );
}
