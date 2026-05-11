import type { ReactNode } from "react"
import styles from "./index.module.css"

export interface TipBarEscHintProps {
	/** 左侧操作说明 */
	tip: ReactNode
	/** Esc 键帽后的说明，如「取消」「退出」 */
	escHintSuffix: ReactNode
}

/**
 * 画布顶部悬浮条：操作说明 + Esc + 后缀文案（与裁剪 / 橡皮擦 / 变高清等一致）
 */
export function TipBarEscHint({ tip, escHintSuffix }: TipBarEscHintProps) {
	return (
		<div className={styles.root}>
			<span>{tip}</span>
			<span className={styles.esc}>Esc</span>
			<span>{escHintSuffix}</span>
		</div>
	)
}
