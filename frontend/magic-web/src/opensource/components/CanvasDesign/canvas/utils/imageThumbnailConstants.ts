/** 小图最大边长（像素）- 用于列表等小图场景 */
export const SMALL_THUMBNAIL_MAX_SIZE = 48

/** tooltip/popover 缩略图最小边长（像素）- 用于悬浮预览等场景 */
export const TOOLTIP_THUMBNAIL_MIN_SIZE = 400

/** 压缩图质量范围：WebP 0.75~0.9，JPEG 降级 0.7~0.85 */
export const COMPRESSED_WEBP_QUALITY = { min: 0.75, max: 0.9 }
export const COMPRESSED_JPEG_QUALITY = { min: 0.7, max: 0.85 }

/** 像素阈值：约 4K 图 (3840*2160)，越大图质量越低 */
export const PIXEL_QUALITY_REF = 3840 * 2160
/** 文件大小阈值（2MB），越大图质量越低 */
export const FILE_SIZE_QUALITY_REF = 2 * 1024 * 1024
/** 像素与文件大小的权重：像素 60%，文件大小 40% */
export const PIXEL_WEIGHT = 0.6
export const FILE_SIZE_WEIGHT = 0.4

/**
 * 根据文件大小 + 原图像素数综合计算压缩质量（大图/大文件低质量，小图/小文件高质量）
 */
export function getCompressedQuality(
	pixelCount: number,
	fileSize: number,
	range: { min: number; max: number },
): number {
	const pixelRatio = Math.min(1, pixelCount / PIXEL_QUALITY_REF)
	const sizeRatio = Math.min(1, fileSize / FILE_SIZE_QUALITY_REF)
	const combinedRatio = pixelRatio * PIXEL_WEIGHT + sizeRatio * FILE_SIZE_WEIGHT
	const quality = range.max - combinedRatio * (range.max - range.min)
	return Math.round(quality * 100) / 100
}
