import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true },
  });

  if (!user) redirect("/login");

  const mappings = await prisma.mapping.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      logs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, success: true },
      },
      _count: { select: { logs: true } },
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";

  return (
    <DashboardClient
      user={user}
      initialMappings={JSON.parse(JSON.stringify(mappings))}
      baseUrl={baseUrl}
    />
  );
}
