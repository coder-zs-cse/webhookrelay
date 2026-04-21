import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  return NextResponse.json({ data: mappings });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { slug, label, targetUrl, logRetain } = await req.json();

    if (!slug || !label || !targetUrl) {
      return NextResponse.json({ error: "slug, label and targetUrl are required" }, { status: 400 });
    }

    // Validate slug format (alphanumeric, hyphens only)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "Slug can only contain lowercase letters, numbers and hyphens" },
        { status: 400 }
      );
    }

    // Validate targetUrl
    try {
      new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: "targetUrl must be a valid URL" }, { status: 400 });
    }

    const existing = await prisma.mapping.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
    }

    const mapping = await prisma.mapping.create({
      data: {
        slug,
        label,
        targetUrl,
        logRetain: logRetain ? Math.max(1, Math.min(100, Number(logRetain))) : 5,
        userId: session.userId,
      },
    });

    return NextResponse.json({ data: mapping }, { status: 201 });
  } catch (err) {
    console.error("Create mapping error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
