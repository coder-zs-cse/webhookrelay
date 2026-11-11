import { RequestLog } from "@prisma/client";
import { config } from "./config";
import { eventBus } from "./eventBus";
import { prisma } from "./prisma";

export async function saveLog(params: {
  mappingId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
  queryParams: Record<string, string>;
  statusCode: number | null;
  success: boolean;
  error: string | null;
  duration: number;
  logRetain: number;
}) {
  const currentLog: RequestLog = await prisma.requestLog.create({
    data: {
      mappingId: params.mappingId,
      method: params.method,
      path: params.path,
      headers: params.headers,
      body: params.body ?? undefined,
      queryParams: params.queryParams,
      statusCode: params.statusCode,
      success: params.success,
      error: params.error,
      duration: params.duration,
    },
  });

  if (config.enableSSE) {
    eventBus.emit(`webhook:${params.mappingId}`, currentLog);
  }

  const logs = await prisma.requestLog.findMany({
    where: { mappingId: params.mappingId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (logs.length > params.logRetain) {
    const toDelete = logs.slice(params.logRetain).map((l: { id: string }) => l.id);
    await prisma.requestLog.deleteMany({ where: { id: { in: toDelete } } });
  }
}
