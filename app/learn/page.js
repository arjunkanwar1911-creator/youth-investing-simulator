import fs from 'node:fs';
import path from 'node:path';
import './page.css';
import PageClient from './client';

export const metadata = {
  title: "Learn — Youth Investing Simulator",
  description: "Five short missions inside the real app, with a quiz before and after to show what you learned.",
};

// The page's words and boxes live in body.html. Next.js reads them here, on the server.
export default function Page() {
  const html = fs.readFileSync(path.join(process.cwd(), 'app/learn/body.html'), 'utf8');
  return <PageClient html={html} />;
}
