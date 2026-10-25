import IconButton from "../../../../primitives/custom/IconButton/index"
import styles from "./index.module.css"
import { Hd } from "lucide-react"
import { useCanvasUI } from "../../../../../app/providers/CanvasUIProvider"
import { ElementToolTypeEnum } from "../../../../../public/props"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import { useMagic } from "../../../../../app/providers/MagicProvider"
import { useMemo } from "react"
import { useImageConvertHightOptions } from "../ImageConvertHight/useImageConvertHightOptions"
import { useElementToolResolution } from "../../../model/ElementToolResolutionContext"
import { generateUUID } from "../../../../../runtime/shared/ids"

export default function ImageConvertHightButton() {
	const { t } = useCanvasDesignI18n()
	const { setActiveToolSession } = useCanvasUI()
	const tool = useElementToolResolution()
	const { convertHightConfig } = useMagic()

	// 使用 hook 获取分辨率选项
	const resolutionOptions = useImageConvertHightOptions(convertHightConfig)

	// 判断是否有可选的选项（至少有一个非 disabled 的选项）
	const hasAvailableOptions = useMemo(() => {
		return resolutionOptions.some((option) => !option.disabled)
	}, [resolutionOptions])

	const handleImageConvertHight = () => {
		if (!tool) return
		setActiveToolSession({
			toolId: ElementToolTypeEnum.ContentEnhance,
			elementId: tool.target.elementId,
			contentId: tool.target.contentId,
			operationId: generateUUID(),
		})
	}

	return (
		<IconButton
			onClick={handleImageConvertHight}
			className={styles.imageConvertHightButton}
			disabled={!hasAvailableOptions}
		>
			<Hd size={16} />
			<span className={styles.buttonText}>
				{t("elementTools.imageConvertHight.title", "高清放大")}
			</span>
		</IconButton>
	)
}
