import './globals.css';

export const metadata = {
  title: 'Motor Fleet Health Console',
  description: 'AI-powered industrial motor health monitoring dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
