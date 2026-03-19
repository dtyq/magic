import { memo } from "react"
import { cx } from "antd-style"
import { useStyles } from "./styles"

export default memo(function BrowserHeader() {
	const { styles } = useStyles()
	return (
		<div className={styles.browserHeader}>
			<div className={cx(styles.red, styles.dot)} />
			<div className={cx(styles.yellow, styles.dot)} />
			<div className={cx(styles.green, styles.dot)} />
		</div>
	)
})
