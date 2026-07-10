import { z } from 'zod';
import { insertFlowSchema, flows } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
};

export const api = {
  flows: {
    list: {
      method: 'GET' as const,
      path: '/api/flows',
      responses: {
        200: z.array(z.custom<typeof flows.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/flows',
      input: insertFlowSchema,
      responses: {
        201: z.custom<typeof flows.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/flows/:id',
      responses: {
        200: z.custom<typeof flows.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/flows/:id',
      input: insertFlowSchema.partial(),
      responses: {
        200: z.custom<typeof flows.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/flows/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    run: {
      method: 'POST' as const,
      path: '/api/flows/:id/run',
      input: z.object({
        /** When set, fed into all Input nodes for this run. Omit to use JSON stored in each Input node. */
        input: z.unknown().optional(),
      }),
      responses: {
        200: z.object({
          output: z.unknown(),
          nodeErrors: z.record(z.string()).optional(),
        }),
        400: errorSchemas.validation,
        401: errorSchemas.validation,
        404: errorSchemas.notFound,
        422: z.object({
          message: z.string(),
          output: z.unknown().optional(),
          nodeErrors: z.record(z.string()).optional(),
        }),
      },
    },
    runByName: {
      method: 'POST' as const,
      path: '/api/flows/run',
      input: z.object({
        flowName: z.string().min(1, 'flowName is required'),
        input: z.unknown().optional(),
      }),
      responses: {
        200: z.object({
          output: z.unknown(),
          flowId: z.number(),
          nodeErrors: z.record(z.string()).optional(),
        }),
        400: errorSchemas.validation,
        401: errorSchemas.validation,
        404: errorSchemas.notFound,
        409: z.object({
          message: z.string(),
        }),
        422: z.object({
          message: z.string(),
          output: z.unknown().optional(),
          nodeErrors: z.record(z.string()).optional(),
        }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
