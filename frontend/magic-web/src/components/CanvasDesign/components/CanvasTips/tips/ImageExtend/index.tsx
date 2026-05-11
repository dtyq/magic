import { useCanvasDesignI18n } from "../../../../context/I18nContext"
import { TipBarEscHint } from "../TipBarEscHint"

export default function ImageExtend() {
	const { t } = useCanvasDesignI18n()

	return (
		<TipBarEscHint
			tip={t("elementTools.imageExtend.tip", "进入图片扩展模式")}
			escHintSuffix={t("common.cancel", "取消")}
		/>
	)
}
