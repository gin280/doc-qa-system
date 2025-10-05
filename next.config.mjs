/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // 将pdf-parse标记为external,避免webpack打包
      config.externals = config.externals || []
      if (Array.isArray(config.externals)) {
        config.externals.push('canvas')
      }
    }
    return config
  },
}

export default nextConfig

