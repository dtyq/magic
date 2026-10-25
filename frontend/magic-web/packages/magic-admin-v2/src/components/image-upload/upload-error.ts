export const publicImageAccept =
	"image/png,image/jpeg,image/jpg,image/gif,image/svg+xml,image/webp"

export type PublicImageUploadErrorKeys = {
	failed: string
	tooLarge: string
	unsupportedType: string
}

export const defaultPublicImageUploadErrorKeys: PublicImageUploadErrorKeys = {
	failed: "platformInfo.upload.failed",
	tooLarge: "platformInfo.upload.tooLarge",
	unsupportedType: "platformInfo.upload.unsupportedType",
}

export function isUploadAbortError(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"name" in error &&
		(error as { name?: unknown }).name === "AbortError"
	)
}

export function getPublicImageUploadErrorMessage(
	error: unknown,
	t: (key: string) => string,
	keys: PublicImageUploadErrorKeys = defaultPublicImageUploadErrorKeys,
) {
	if (isUploadAbortError(error)) return null

	const message = error instanceof Error ? error.message : ""
	if (message === "UNSUPPORTED_IMAGE_TYPE") return t(keys.unsupportedType)
	if (message === "IMAGE_TOO_LARGE") return t(keys.tooLarge)
	return t(keys.failed)
}

export function isSafePublicImageUrl(value: string) {
	return /^(https?:\/\/|blob:)/i.test(value.trim())
}
