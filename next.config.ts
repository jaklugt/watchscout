import type { NextConfig } from 'next'

const config: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      { protocol: 'https', hostname: '**.imgix.net' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: 'media.juwelierburger.com' },
      { protocol: 'https', hostname: 'preowned.schaapcitroen.nl' },
      { protocol: 'https', hostname: 'chronexttime.imgix.net' },
    ],
  },
}

export default config
