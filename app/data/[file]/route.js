// Serves the price files in data/ at /data/forex.json, /data/stocks.json and /data/meta.json.
// The files stay in data/ because the nightly price bot writes them there.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-static';
export const dynamicParams = false;

const DATA_DIR = path.join(process.cwd(), 'data');

export async function generateStaticParams() {
  const files = await readdir(DATA_DIR);
  return files.filter((f) => f.endsWith('.json')).map((file) => ({ file }));
}

export async function GET(_request, { params }) {
  const { file } = await params;
  const text = await readFile(path.join(DATA_DIR, file), 'utf8');
  return new Response(text, { headers: { 'content-type': 'application/json; charset=utf-8' } });
}
