import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "s1.ticketm.net" },
      { protocol: "https", hostname: "img.evbuc.com" },
      { protocol: "https", hostname: "cdn.evbuc.com" },
      { protocol: "https", hostname: "secure.meetupstatic.com" },
      { protocol: "https", hostname: "photos.meetupstatic.com" },
    ],
  },
  async rewrites() {
    return [{ source: "/e/:id", destination: "/events/:id" }];
  },
};

export default nextConfig;
