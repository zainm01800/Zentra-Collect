import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zentracollect.co.uk";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Only public, indexable pages. Authenticated app routes are listed in robots.txt
  // as Disallow and excluded here.
  return [
    { url: `${SITE_URL}/`,                lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${SITE_URL}/login`,           lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/demo`,            lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/help`,            lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/terms`,           lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${SITE_URL}/privacy`,         lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${SITE_URL}/cookies`,         lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${SITE_URL}/request-access`,  lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}
