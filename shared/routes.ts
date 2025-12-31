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
