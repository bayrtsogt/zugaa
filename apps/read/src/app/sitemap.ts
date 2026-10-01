import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";
import { listStories } from "@/lib/content";

// Public story pages only; chapter pages are reachable from them.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const stories = await listStories({ limit: 1000 }).catch(() => []);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/library`, changeFrequency: "daily", priority: 0.8 },
    ...stories.map((s) => ({ url: `${base}/s/${s.slug}`, lastModified: s.published_at ?? undefined, changeFrequency: "weekly" as const })),
  ];
}
