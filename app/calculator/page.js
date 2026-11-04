import fs from 'node:fs';
import path from 'node:path';
import './page.css';
import '../../tutorial.css';
import PageClient from './client';

export const metadata = {
  title: "Compound interest calculator — Youth Investing Simulator",
  description: "See what your money does over time, and what waiting five years costs you.",
};

// The page's words and boxes live in body.html. Next.js reads them here, on the server.
export default function Page() {
  const html = fs.readFileSync(path.join(process.cwd(), 'app/calculator/body.html'), 'utf8');
  return <PageClient html={html} />;
}
