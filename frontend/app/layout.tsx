import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import dynamic from 'next/dynamic';

// Dynamically import Toaster to prevent hydration issues
const Toaster = dynamic(() => import('react-hot-toast').then(mod => ({ default: mod.Toaster })), {
  ssr: false,
});

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SAM2 Building Painter - AI-Powered Building Segmentation & Coloring',
  description: 'Upload images of Indian houses and buildings, generate segmentation masks using SAM2, and interactively paint walls with beautiful colors. Powered by Meta AI\'s Segment Anything Model 2.',
  keywords: 'SAM2, building segmentation, AI, image processing, building painting, Indian houses, Meta AI',
  authors: [{ name: 'SAM2 Building Painter Team' }],
  robots: 'index, follow',
  openGraph: {
    title: 'SAM2 Building Painter',
    description: 'AI-Powered Building Segmentation & Coloring Tool',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SAM2 Building Painter',
    description: 'AI-Powered Building Segmentation & Coloring Tool',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
          {children}
        </div>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#4ade80',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </body>
    </html>
  );
} 