import styles from "./index.module.css"
import { Brush } from "../../../ui/icons/index"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"

export default function LayersEmpty() {
	const { t } = useCanvasDesignI18n()
	return (
		<div className={styles.layersEmpty}>
			<div className={styles.layersEmptyIcon}>
				<Brush size={24} />
			</div>
			<div className={styles.layersEmptyTitle}>{t("layers.empty.title", "画布内容为空")}</div>
			<div className={styles.layersEmptyDescription}>
				{t("layers.empty.description", "让智能体帮你轻松生成各种创意图像!")}
			</div>
		</div>
	)
}
