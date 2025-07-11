import { IconChevronRight } from "@tabler/icons-react"
import { Collapse, type CollapseProps } from "antd"
import MagicIcon from "../MagicIcon"
import { useStyles } from "./style"

export type MagicCollapseProps = CollapseProps

function MagicCollapse({ className, ...props }: MagicCollapseProps) {
	const { styles, cx } = useStyles()

	return (
		<Collapse
			ghost
			className={cx(styles.container, className)}
			bordered={false}
			expandIconPosition="end"
			expandIcon={({ isActive }) => (
				<MagicIcon
					component={IconChevronRight}
					size={24}
					style={{
						transform: `rotate(${isActive ? 90 : 0}deg)`,
						transition: "transform 0.35s cubic-bezier(0.215, 0.61, 0.355, 1)",
					}}
				/>
			)}
			{...props}
		/>
	)
}

export default MagicCollapse
