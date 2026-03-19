import { useStyles } from "./style"

export default function Empty() {
	const { styles } = useStyles()
	return (
		<div className={styles.emptyContainer}>
			<div className={styles.emptyIcon}>👋🏻</div>
			<div className={styles.emptyTitle}>Hello, 我是超级麦吉</div>
			<div className={styles.emptyText}>我能为您做些什么？</div>
		</div>
	)
}
