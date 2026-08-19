import { prisma } from "@/lib/db";

/**
 * The app is single-tenant per deployment: one contract, one site. This
 * resolves it, creating a placeholder on first run so a fresh install is
 * usable before anyone has configured anything.
 */
export async function getSite() {
  const existing = await prisma.site.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;

  return prisma.site.create({
    data: { name: "Unnamed site", location: null },
  });
}

export async function getSiteId() {
  return (await getSite()).id;
}
