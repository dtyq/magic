import { z } from "zod"

const providerValueSchema = z.unknown()

export const providerSchema = z
	.object({
		provider: z.string(),
		provider_code: z.string().optional(),
		name: z.string().optional(),
		enable: z.boolean(),
	})
	.catchall(providerValueSchema)

export const capabilityFormSchema = z.object({
	status: z.boolean(),
	selectedProvider: z.string(),
	model_id: z.string().optional(),
	prompt: z.string().optional(),
	provider: providerSchema,
})

export type CapabilityFormValues = z.infer<typeof capabilityFormSchema>
