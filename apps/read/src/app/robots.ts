import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/me", "/pay", "/shop", "/login", "/auth"] }],
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
