import { useCallback, useEffect } from "react"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import { useCanvasUI } from "../../../../../app/providers/CanvasUIProvider"
import { TipBarEscHint } from "../TipBarEscHint/index"

export default function ImageConvertHight() {
	const { t } = useCanvasDesignI18n()
	const { setActiveToolSession } = useCanvasUI()

	const handleEsc = useCallback(() => {
		setActiveToolSession(null)
	}, [setActiveToolSession])

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
