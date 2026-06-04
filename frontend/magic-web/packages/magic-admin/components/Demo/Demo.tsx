import type { PropsWithChildren } from "react"
import { useAdminComponents } from "../AdminComponentsProvider"
import { useStyles } from "./style"

export interface DemoProps extends PropsWithChildren {
	title?: string
}

function Demo(props: DemoProps) {
	const { title, children } = props

	/** ================== Styles ================== */
	const { styles } = useStyles()

	/** ================== Locale ================== */
	const { getLocale } = useAdminComponents()
	const locale = getLocale("Demo")

	return (
		<div className={styles.card}>
			<div className={styles.header}>
				{locale.title} {title}
			</div>
			<div className={styles.wrapper}>{children}</div>
		</div>
	)
}

export default Demo
