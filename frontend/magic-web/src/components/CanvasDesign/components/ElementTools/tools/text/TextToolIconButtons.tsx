import { useCallback } from "react"
import type { LucideIcon } from "lucide-react"
import IconButton from "../../../ui/custom/IconButton/index"
import styles from "./TextToolIconButtons.module.css"

interface TextToolIconButtonItem {
	key: string
	label: string
	icon: LucideIcon
	selected: boolean
	onClick: () => void
}

interface TextToolIconButtonsProps {
	items: TextToolIconButtonItem[]
}

export default function TextToolIconButtons({ items }: TextToolIconButtonsProps) {
	const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
		event.preventDefault()
	}, [])

	return (
		<div className={styles.buttonGroup}>
			{items.map((item) => {
				const Icon = item.icon
				return (
					<IconButton
						key={item.key}
						className={styles.iconButton}
						selected={item.selected}
						data-selected={item.selected}
						aria-label={item.label}
						title={item.label}
						onMouseDown={handleMouseDown}
						onClick={item.onClick}
					>
						<Icon size={16} />
					</IconButton>
				)
			})}
		</div>
	)
}
