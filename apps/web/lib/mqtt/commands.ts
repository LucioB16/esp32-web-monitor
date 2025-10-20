import { z } from 'zod'

export const commandPayloadSchema = z.object({
  id: z.string().min(1),
  url: z.string().url().optional(),
  interval_s: z.number().int().positive().optional(),
  mode: z.enum(['full', 'selector', 'markers', 'regex']).optional(),
  selector_css: z.string().optional(),
  start_marker: z.string().optional(),
  end_marker: z.string().optional(),
  regex: z.string().optional(),
  headers: z.record(z.string()).optional(),
  paused: z.boolean().optional()
})

export const commandTypeSchema = z.enum(['UPSERT_SITE', 'DELETE_SITE', 'PAUSE_SITE', 'RESUME_SITE', 'CHECK_NOW'])

export const commandSchema = z.object({
  type: commandTypeSchema,
  payload: commandPayloadSchema,
  ts: z.number().optional(),
  hmac: z.string().optional()
})

export type CommandPayload = z.infer<typeof commandPayloadSchema>
export type CommandType = z.infer<typeof commandTypeSchema>
export type CommandInput = z.infer<typeof commandSchema>
