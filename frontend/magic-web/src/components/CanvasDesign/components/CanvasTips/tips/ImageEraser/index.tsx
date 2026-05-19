import { useCanvasDesignI18n } from "../../../../context/I18nContext"
import { TipBarEscHint } from "../TipBarEscHint"

export default function ImageEraser() {
	const { t } = useCanvasDesignI18n()

	return (
		<TipBarEscHint
			tip={t("elementTools.imageEraser.tip", "涂抹可擦除区域")}
			escHintSuffix={t("common.cancel", "取消")}
		/>
	)
}
