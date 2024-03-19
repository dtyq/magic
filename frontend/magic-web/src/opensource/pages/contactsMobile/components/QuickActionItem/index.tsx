import { observer } from "mobx-react-lite"

// Styles
import { useStyles } from "./styles"

// Types
import type { QuickActionItem } from "../../types"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconChevronRight } from "@tabler/icons-react"

/**
 * QuickActionItem - 快捷操作项组件
 *
 * @param props - 组件属性
 * @returns JSX.Element
 */
const QuickActionItemComponent = observer((props: QuickActionItem) => {
	const { name, icon, backgroundColor, onClick, className, style } = props
	const { styles } = useStyles()

	return (
		<div className={`${styles.container} ${className || ""}`} style={style} onClick={onClick}>
			<div className={styles.iconContainer} style={{ backgroundColor }}>
				{icon}
			</div>
			<span className={styles.actionText}>{name}</span>
			<MagicIcon component={IconChevronRight} />
		</div>
	)
})

QuickActionItemComponent.displayName = "QuickActionItem"

export default QuickActionItemComponent
