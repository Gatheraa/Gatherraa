import withBundleAnalyzer from '@next/bundle-analyzer';

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

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: true,
});

export default bundleAnalyzer(nextConfig);
