import { cx, createStyles } from "antd-style"
import * as React from "react"

const useStyles = createStyles(({ css, token }) => ({
	handle: css`
		position: absolute;
		top: 50%;
		height: 2.5rem;
		max-height: 100%;
		width: 0.375rem;
		transform: translateY(-50%);
		cursor: col-resize;
		border-radius: 0.25rem;
		border: 1px solid ${token.magicColorUsages.border};
		background-color: ${token.magicColorUsages.fill[1]};
		padding: 1px;
		transition: all 0.2s;
		opacity: 1;
		backdrop-filter: saturate(1.8) blur(20px);

		&:before {
			content: "";
			position: absolute;
			inset-block: 0;
			left: -0.25rem;
			right: -0.25rem;
		}
	`,
	resizing: css`
		opacity: 0.8;
	`,
	hoverVisible: css`
		.group-hover\\/node-image & {
			opacity: 0.8;
		}
	`,
}))

interface ResizeProps extends React.HTMLAttributes<HTMLDivElement> {
	isResizing?: boolean
}

export const ResizeHandle = React.forwardRef<HTMLDivElement, ResizeProps>(
	({ className, isResizing = false, ...props }, ref) => {
		const { styles } = useStyles()
		return (
			<div
				className={cx(
					styles.handle,
					{
						[styles.resizing]: isResizing,
						[styles.hoverVisible]: !isResizing,
					},
					className,
				)}
				ref={ref}
				{...props}
			/>
		)
	},
)
