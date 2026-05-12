import { useCanvasDesignI18n } from "../../../../context/I18nContext"
import { TipBarEscHint } from "../TipBarEscHint"

export default function ImageCrop() {
	const { t } = useCanvasDesignI18n()

	return (
		<TipBarEscHint
			tip={t("elementTools.imageCrop.tip", "拖拽调整裁剪区域")}
			escHintSuffix={t("common.cancel", "取消")}
		/>
	)
}
