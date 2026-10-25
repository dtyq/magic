import { memo, type PointerEventHandler } from "react"
import { CircleQuestionMark, GripHorizontal, Puzzle, X } from "lucide-react"

import styles from "./index.module.css"
import type { PluginView } from "./types"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"

export const PluginWindowHeader = memo(function PluginWindowHeader({
	icon,
	label,
	description,
	onClose,
	onPointerDown,
	onPointerMove,
	onPointerUp,
}: {
	icon: PluginView["icon"]
	label: string
	description: string
	onClose: () => void
	onPointerDown: PointerEventHandler<HTMLDivElement>
	onPointerMove: PointerEventHandler<HTMLDivElement>
	onPointerUp: PointerEventHandler<HTMLDivElement>
}) {
	return (
		<div
			className={styles.pluginWindowHeader}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
		>
			<div className={styles.pluginWindowHeaderContent}>
				<GripHorizontal size={14} />
				<div className={styles.pluginTitleIcon}>
					{icon?.type === "emoji" ? (
						icon.value
					) : icon?.type === "image" ? (
						<img className={styles.pluginTitleIconImage} src={icon.value} alt="" />
					) : (
						<Puzzle size={15} />
					)}
				</div>
				<span className={styles.pluginWindowTitle} title={label}>
					{label}
				</span>
				<Tooltip delayDuration={200}>
					<TooltipTrigger asChild>
						<button type="button" aria-label="Help">
							<CircleQuestionMark size={16} />
						</button>
					</TooltipTrigger>
					<TooltipContent>{description}</TooltipContent>
				</Tooltip>
			</div>
			<button
				type="button"
				className={styles.pluginWindowClose}
				aria-label="Close plugin"
				onClick={onClose}
			>
				<X size={16} />
			</button>
		</div>
	)
})
