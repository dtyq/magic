import { IconChevronDown, IconChevronUp } from "@tabler/icons-react"
import { useMemo, useState } from "react"
import { useCollapseStyles } from "./styles/collapse.style"

export const useCollapse = () => {
	const { styles } = useCollapseStyles()
	const [collapsed, setCollapsed] = useState(true)

	const DropdownIcon = useMemo(() => {
		return collapsed ? (
			<IconChevronDown
				size={18}
				onClick={(e) => {
					e.stopPropagation()
					setCollapsed(false)
				}}
				className={styles.collapse}
			/>
		) : (
			<IconChevronUp
				size={18}
				onClick={(e) => {
					e.stopPropagation()
					setCollapsed(true)
				}}
				className={styles.collapse}
			/>
		)
	}, [collapsed, styles.collapse])

	return {
		collapsed,
		setCollapsed,
		DropdownIcon,
		collapseCardClassName: styles.collapseCard,
		expandedCardClassName: styles.expandedCard,
	}
}
