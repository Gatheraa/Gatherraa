/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  
  // Experimental features for optimization
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@hookform/resolvers',
    ],
  },
  
  // Compression
  compress: true,
};

// Bundle analyzer (enabled via ANALYZE env var)
if (process.env.ANALYZE === 'true') {
  const withBundleAnalyzer = (await import('@next/bundle-analyzer')).default;
  const analyzer = withBundleAnalyzer({
    enabled: true,
    openAnalyzer: true,
  });
  export default analyzer(nextConfig);
} else {
  export default nextConfig;
}
