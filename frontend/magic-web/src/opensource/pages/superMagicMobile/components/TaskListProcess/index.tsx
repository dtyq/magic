import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react"
import { createStyles, cx } from "antd-style"
import { memo } from "react"

interface TaskListProcessProps {
	className?: string
	style?: React.CSSProperties
	min?: number
	max?: number
	collapsed?: boolean
}

const useStyles = createStyles(({ token }) => ({
	process: {
		display: "flex",
		gap: 10,
		alignItems: "center",
		fontSize: 12,
		fontWeight: 400,
		lineHeight: "16px",
		color: token.magicColorUsages.text[2],
	},
	icon: {
		stroke: token.magicColorUsages.text[2],
	},
}))

export default memo(function TaskListProcess(props: TaskListProcessProps) {
	const { className, style, min = 0, max = 0, collapsed = true } = props
	const { styles } = useStyles()
	return (
		<div className={cx(styles.process, className)} style={style}>
			<div>
				<span>{min}</span>
				<span>/</span>
				<span>{max}</span>
			</div>
			<MagicIcon
				size={16}
				stroke={2}
				component={collapsed ? IconChevronDown : IconChevronUp}
				className={styles.icon}
			/>
		</div>
	)
})
