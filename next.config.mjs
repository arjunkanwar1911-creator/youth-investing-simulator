// Old links like /trade.html keep working: they show the same page as /trade.
const oldLinks = ['calculator', 'learn', 'markets', 'trade'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Off on purpose: in development React would start each page's code twice.
  reactStrictMode: false,
  async rewrites() {
    return [
      { source: '/index.html', destination: '/' },
      ...oldLinks.map((name) => ({ source: `/${name}.html`, destination: `/${name}` })),
    ];
  },
};

export default nextConfig;
