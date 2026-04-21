import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const mapping = await prisma.mapping.findUnique({ where: { id } });
  if (!mapping || mapping.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const logs = await prisma.requestLog.findMany({
    where: { mappingId: id },
    orderBy: { createdAt: "desc" },
    take: mapping.logRetain,
  });

  return NextResponse.json({ data: logs });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const mapping = await prisma.mapping.findUnique({ where: { id } });
  if (!mapping || mapping.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.requestLog.deleteMany({ where: { mappingId: id } });
  return NextResponse.json({ message: "Logs cleared" });
}
