import { z } from 'zod'

export const siteIdSchema = z
  .string()
  .trim()
  .min(1, 'El id es obligatorio')
  .max(128, 'El id no puede exceder 128 caracteres')
  .regex(/^[a-z0-9:_-]+$/i, 'El id solo puede contener letras, números, guiones, guiones bajos y dos puntos')

export const siteModeSchema = z.enum(['full', 'selector', 'markers', 'regex'])

export const headersSchema = z
  .record(z.string().min(1), z.string().min(1))
  .optional()

const optionalString = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((value) => {
    if (value === null || value === undefined) {
      return undefined
    }
    const trimmed = value.trim()
    if (!trimmed) {
      return undefined
    }
    return trimmed
  })
  .refine((value) => value === undefined || value.length <= 1024, {
    message: 'El texto es demasiado largo'
  })

export const siteBaseSchema = z.object({
  id: siteIdSchema,
  url: z.string().trim().url('URL inválida'),
  interval_s: z
    .union([z.number(), z.string()])
    .transform((value) => {
      if (typeof value === 'number') {
        return value
      }
      const numeric = Number(value)
      if (!Number.isFinite(numeric)) {
        return NaN
      }
      return numeric
    })
    .pipe(
      z
        .number({ invalid_type_error: 'Intervalo inválido' })
        .int('El intervalo debe ser un entero')
        .min(30, 'Intervalo mínimo de 30 segundos')
        .max(86_400, 'Intervalo máximo 24h')
    ),
  mode: siteModeSchema,
  selector_css: optionalString,
  start_marker: optionalString,
  end_marker: optionalString,
  regex: optionalString,
  headers: headersSchema,
  paused: z.boolean().optional(),
  created_at: z
    .number({ invalid_type_error: 'Marca de tiempo inválida' })
    .int('Marca de tiempo inválida')
    .nonnegative('Marca de tiempo inválida'),
  updated_at: z
    .number({ invalid_type_error: 'Marca de tiempo inválida' })
    .int('Marca de tiempo inválida')
    .nonnegative('Marca de tiempo inválida')
})

export const siteWriteSchema = siteBaseSchema
  .omit({ created_at: true, updated_at: true })
  .extend({
    created_at: z
      .number({ invalid_type_error: 'Marca de tiempo inválida' })
      .int('Marca de tiempo inválida')
      .nonnegative('Marca de tiempo inválida')
      .optional(),
    updated_at: z
      .number({ invalid_type_error: 'Marca de tiempo inválida' })
      .int('Marca de tiempo inválida')
      .nonnegative('Marca de tiempo inválida')
      .optional()
  })
  .superRefine((value, ctx) => {
    const mode = value.mode
    if (mode === 'selector' && !value.selector_css) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selector_css'],
        message: 'Requerido para modo selector'
      })
    }
    if (mode === 'markers' && (!value.start_marker || !value.end_marker)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['start_marker'],
        message: 'Requerido para modo markers'
      })
    }
    if (mode === 'regex' && !value.regex) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['regex'],
        message: 'Requerido para modo regex'
      })
    }
  })

export const siteSchema = siteBaseSchema

export const siteStatusSchema = z.object({
  id: siteIdSchema,
  last_http: z.number().int().nonnegative().optional(),
  last_size: z.number().int().nonnegative().optional(),
  last_hash: optionalString,
  last_excerpt: optionalString,
  last_changed: z.boolean().optional(),
  last_error: optionalString,
  updated_at: z.number().int().nonnegative().optional()
})

export type Mode = z.infer<typeof siteModeSchema>
export type Site = z.infer<typeof siteSchema>
export type SiteWrite = z.infer<typeof siteWriteSchema>
export type SiteStatus = z.infer<typeof siteStatusSchema>
