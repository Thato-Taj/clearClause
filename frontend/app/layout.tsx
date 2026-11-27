import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible_Next, Atkinson_Hyperlegible_Mono, Source_Serif_4 } from 'next/font/google';
import { Providers } from '@/components/Providers';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import './globals.css';

const body = Atkinson_Hyperlegible_Next({ variable: '--font-body', subsets: ['latin'], display: 'swap', adjustFontFallback: false });
const display = Source_Serif_4({ variable: '--font-display', subsets: ['latin'], display: 'swap', weight: ['500', '600', '700'] });
const mono = Atkinson_Hyperlegible_Mono({ variable: '--font-mono-face', subsets: ['latin'], display: 'swap', adjustFontFallback: false });

export const metadata: Metadata = {
  title: {
    default: 'ClearClause — know what you’re agreeing to',
    template: '%s · ClearClause',
  },
  description:
    'ClearClause checks contracts, terms and conditions and privacy policies against South African law — POPIA, the Consumer Protection Act and more — and explains the problems in plain language.',
  applicationName: 'ClearClause',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#121215' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en-ZA" suppressHydrationWarning className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-dvh flex flex-col antialiased">
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-ink focus:text-paper focus:px-4 focus:py-2 focus:rounded-md"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
