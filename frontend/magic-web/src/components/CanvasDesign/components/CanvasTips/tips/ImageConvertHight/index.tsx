import { useCallback, useEffect } from "react"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"
import { useCanvasUI } from "../../../../context/CanvasUIContext"
import { TipBarEscHint } from "../TipBarEscHint"

export default function ImageConvertHight() {
	const { t } = useCanvasDesignI18n()
	const { setSubElementTooltip } = useCanvasUI()

	const handleEsc = useCallback(() => {
		setSubElementTooltip(null)
	}, [setSubElementTooltip])

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				handleEsc()
			}
		}

		window.addEventListener("keydown", handleKeyDown)

		return () => {
			window.removeEventListener("keydown", handleKeyDown)
		}
	}, [handleEsc])

	return (
		<TipBarEscHint
			tip={t("elementTools.imageConvertHight.tip", "选择放大倍数")}
			escHintSuffix={t("elementTools.imageConvertHight.exitHint", "退出")}
		/>
	)
}
