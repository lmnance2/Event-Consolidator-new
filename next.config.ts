import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "s1.ticketm.net" },
      { protocol: "https", hostname: "img.evbuc.com" },
      { protocol: "https", hostname: "cdn.evbuc.com" },
      { protocol: "https", hostname: "secure.meetupstatic.com" },
      { protocol: "https", hostname: "photos.meetupstatic.com" },
    ],
  },
};

export default nextConfig;
