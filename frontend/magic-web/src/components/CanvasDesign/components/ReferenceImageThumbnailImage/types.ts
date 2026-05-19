import type { CropConfig } from "../../canvas/types"

export interface ReferenceImageThumbnailImageProps {
	fileName: string
	path: string
	/** 铺满父容器（如 SourceList 槽位）；与 `objectFit` 共同决定缩放方式 */
	fillParent?: boolean
	/** cover：裁切铺满；contain：长边贴齐槽位、整图可见并居中 */
	objectFit?: "cover" | "contain"
	/** 无 Tooltip；槽位内优先展示原图（ossSrc），与缩略图并行加载 */
	inlineOriginal?: boolean
	/** 源图裁剪（与画布 ImageElement.crop 一致）；需资源 imageInfo 就绪后按裁剪区铺满缩略图 */
	sourceCrop?: CropConfig
}
