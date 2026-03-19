import { memo } from "react"
import type { SettingContentProps } from "../types"
import { useStyles } from "../styles"

function SettingContent({ children }: SettingContentProps) {
	const { styles } = useStyles()

	return <div className={styles.content}>{children}</div>
}

export default memo(SettingContent)
