import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { memo } from "react"
import { useStyles } from "./styles"
import ToolHeader from "../ToolHeader"

interface TextEditorProps extends React.PropsWithChildren {
	file?: AttachmentItem
	language?: string
	extension?: string
	title?: string
	icon?: React.ReactNode
	suffix?: React.ReactNode | JSX.Element | JSX.Element[]
	showTitle?: boolean
	className?: string
	contentClassName?: string
	headerClassName?: string
	showHeader?: boolean
}

function ToolDetailContainer({
	file,
	extension,
	title,
	children,
	icon,
	suffix,
	showTitle = true,
	className,
	contentClassName,
	headerClassName,
	showHeader = true,
}: TextEditorProps) {
	const { styles, cx } = useStyles()

	return (
		<div className={cx(styles.container, className)}>
			{showHeader && (
				<ToolHeader
					file={file}
					extension={extension}
					title={title}
					icon={icon}
					suffix={suffix}
					showTitle={showTitle}
					headerClassName={headerClassName}
				/>
			)}

			<div className={cx(styles.content, contentClassName)}>{children}</div>
		</div>
	)
}

export default memo(ToolDetailContainer)
