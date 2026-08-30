import { prisma } from "../../lib/db/client.ts";

const [events, sources, users, active, upcoming] = await Promise.all([
  prisma.event.count(),
  prisma.eventSource.count(),
  prisma.user.count(),
  prisma.event.count({ where: { isActive: true } }),
  prisma.event.count({ where: { isActive: true, startTime: { gte: new Date() } } }),
]);

const byProvider = await prisma.eventSource.groupBy({
  by: ["provider"],
  _count: { _all: true },
});

console.log(JSON.stringify({ events, sources, users, active, upcoming, byProvider }, null, 2));
await prisma.$disconnect();
