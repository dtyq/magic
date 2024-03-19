import { ElementTypeEnum, type LayerElement } from "../types"

/**
 * 验证元素数据结构是否有效
 * @param data - 待验证的数据
 * @returns 是否为有效的元素数据
 */
export function isValidElementData(data: unknown): data is LayerElement {
	if (!data || typeof data !== "object") {
		return false
	}

	const element = data as Record<string, unknown>

	// 验证必需字段
	if (typeof element.id !== "string" || !element.id) {
		return false
	}

	if (typeof element.type !== "string" || !element.type) {
		return false
	}

	// 验证类型是否在支持的类型中
	const validTypes = Object.values(ElementTypeEnum) as string[]
	if (!validTypes.includes(element.type as string)) {
		return false
	}

	// 验证可选的数值字段
	const numericFields = ["x", "y", "width", "height", "scaleX", "scaleY", "zIndex", "opacity"]
	for (const field of numericFields) {
		if (element[field] !== undefined && typeof element[field] !== "number") {
			return false
		}
	}

	// 验证可选的布尔字段
	const booleanFields = ["visible", "locked"]
	for (const field of booleanFields) {
		if (element[field] !== undefined && typeof element[field] !== "boolean") {
			return false
		}
	}

	// 验证可选的字符串字段
	const stringFields = ["name"]
	for (const field of stringFields) {
		if (element[field] !== undefined && typeof element[field] !== "string") {
			return false
		}
	}

	// 验证特定类型的额外字段
	switch (element.type) {
		case ElementTypeEnum.Frame:
		case ElementTypeEnum.Group:
			// 验证 children 字段（如果存在）
			if (element.children !== undefined) {
				if (!Array.isArray(element.children)) {
					return false
				}
				// 递归验证子元素
				for (const child of element.children) {
					if (!isValidElementData(child)) {
						return false
					}
				}
			}
			break

		case ElementTypeEnum.Rectangle:
		case ElementTypeEnum.Ellipse:
		case ElementTypeEnum.Triangle:
			// 验证形状特有的字段
			if (element.fill !== undefined && typeof element.fill !== "string") {
				return false
			}
			if (element.stroke !== undefined && typeof element.stroke !== "string") {
				return false
			}
			if (element.strokeWidth !== undefined && typeof element.strokeWidth !== "number") {
				return false
			}
			if (
				element.type === ElementTypeEnum.Rectangle &&
				element.cornerRadius !== undefined &&
				typeof element.cornerRadius !== "number"
			) {
				return false
			}
			break

		case ElementTypeEnum.Star:
			// 验证星形特有的字段
			if (element.fill !== undefined && typeof element.fill !== "string") {
				return false
			}
			if (element.stroke !== undefined && typeof element.stroke !== "string") {
				return false
			}
			if (element.strokeWidth !== undefined && typeof element.strokeWidth !== "number") {
				return false
			}
			if (element.cornerRadius !== undefined && typeof element.cornerRadius !== "number") {
				return false
			}
			if (element.sides !== undefined && typeof element.sides !== "number") {
				return false
			}
			if (
				element.innerRadiusRatio !== undefined &&
				typeof element.innerRadiusRatio !== "number"
			) {
				return false
			}
			break

		case ElementTypeEnum.Text:
			// 验证文本特有的字段
			if (element.content !== undefined) {
				if (!Array.isArray(element.content)) {
					return false
				}
				// 简单验证段落结构
				for (const paragraph of element.content) {
					if (!paragraph || typeof paragraph !== "object") {
						return false
					}
				}
			}
			break

		case ElementTypeEnum.Image:
			// 验证图片特有的字段
			if (element.src !== undefined && typeof element.src !== "string") {
				return false
			}
			if (element.status !== undefined && typeof element.status !== "string") {
				return false
			}
			if (element.errorMessage !== undefined && typeof element.errorMessage !== "string") {
				return false
			}
			break
	}

	return true
}
