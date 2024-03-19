/**
 *
 * @param imageUrl Image URL to check
 * @returns True if URL appears to be a OSS-compatible public bucket URL
 */
export function isOssPublicImageUrl(imageUrl: string): boolean {
	const privateBucketIndicators = [/OSSAccessKeyId=/i, /Expires=/i, /Signature=/i]

	if (privateBucketIndicators.some((pattern) => pattern.test(imageUrl))) {
		return false
	}

	const publicOssPatterns = [/aliyuncs\.com/i]

	return publicOssPatterns.some((pattern) => pattern.test(imageUrl))
}
