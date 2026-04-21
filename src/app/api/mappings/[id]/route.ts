import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getOwnedMapping(mappingId: string, userId: string) {
  const mapping = await prisma.mapping.findUnique({ where: { id: mappingId } });
  if (!mapping) return null;
  if (mapping.userId !== userId) return null;
  return mapping;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const mapping = await getOwnedMapping(id, session.userId);
  if (!mapping) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
   const { label, targetUrl, logRetain, isActive, alwaysReturn200 } = await req.json();

    if (targetUrl) {
      try {
        new URL(targetUrl);
      } catch {
        return NextResponse.json({ error: "targetUrl must be a valid URL" }, { status: 400 });
      }
    }

   const updated = await prisma.mapping.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(targetUrl !== undefined && { targetUrl }),
        ...(logRetain !== undefined && {
          logRetain: Math.max(1, Math.min(100, Number(logRetain))),
        }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(alwaysReturn200 !== undefined && { alwaysReturn200: Boolean(alwaysReturn200) }),  // ← add this
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Update mapping error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const mapping = await getOwnedMapping(id, session.userId);
  if (!mapping) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.mapping.delete({ where: { id } });
  return NextResponse.json({ message: "Deleted" });
}
