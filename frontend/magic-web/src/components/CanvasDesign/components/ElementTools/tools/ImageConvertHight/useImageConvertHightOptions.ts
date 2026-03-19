import { useMemo } from "react"
import type { SizeOption } from "../../../ui/custom/SizeSelect"
import type { GetConvertHightConfigResponse } from "../../../../types.magic"

/**
 * 获取高清转换的分辨率选项
 * @param convertHightConfig 转高清配置
 * @returns 尺寸选项列表（value 为宽x高格式）
 */
export function useImageConvertHightOptions(
	convertHightConfig: GetConvertHightConfigResponse | null,
): SizeOption[] {
	const resolutionOptions = useMemo<SizeOption[]>(() => {
		if (!convertHightConfig?.image_size_config?.sizes) {
			return []
		}

		return convertHightConfig.image_size_config.sizes.map((size) => ({
			label: size.label, // 显示的标签，如 "1:1", "16:9"
			value: size.value, // 选项的值，格式为 "宽度x高度"，如 "1024x1024"
			disabled: false, // 是否禁用
			data: size, // 完整的 image_size_config item
		}))
	}, [convertHightConfig?.image_size_config?.sizes])

	return resolutionOptions
}
