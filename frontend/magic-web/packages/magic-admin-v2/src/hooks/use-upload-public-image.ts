import { useRuntime } from "@magic-admin-v2/runtime/context"

export type { UploadedImage } from "@magic-admin-v2/capabilities/types"

/**
 * Exposes the runtime-provided public image upload capability to React components.
 * Embedded hosts remain responsible for authentication, organization, language,
 * and base-url handling.
 */
export function useUploadPublicImage() {
	return useRuntime().capabilities.uploadPublicImage
}
