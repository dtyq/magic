import IconButton from "../../../ui/custom/IconButton/index"
import styles from "./index.module.css"
import { Hd } from "../../../ui/icons/index"
import { useCanvasUI } from "../../../../context/CanvasUIContext"
import { ElementToolTypeEnum } from "../../../../types"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"
import { useMagic } from "../../../../context/MagicContext"
import { useMemo } from "react"
import { useImageConvertHightOptions } from "../ImageConvertHight/useImageConvertHightOptions"

export default function ImageConvertHightButton() {
	const { t } = useCanvasDesignI18n()
	const { setSubElementTooltip } = useCanvasUI()
	const { convertHightConfig } = useMagic()

	// 使用 hook 获取分辨率选项
	const resolutionOptions = useImageConvertHightOptions(convertHightConfig)

	// 判断是否有可选的选项（至少有一个非 disabled 的选项）
	const hasAvailableOptions = useMemo(() => {
		return resolutionOptions.some((option) => !option.disabled)
	}, [resolutionOptions])

	const handleImageConvertHight = () => {
		setSubElementTooltip(ElementToolTypeEnum.ImageConvertHight)
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
