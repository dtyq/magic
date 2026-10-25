import { FileResourceIcon } from "@/pages/superMagic/components/TopicFilesButton/components/FileResourceIcon"
import { resolveFilePresentation } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { useMessageListContext } from "@/pages/superMagic/components/MessageList/context"
import { Flex } from "antd"
import { observer } from "mobx-react-lite"
import { useStyles } from "./styles"
import MagicFileIcon from "@/components/base/MagicFileIcon"

interface ToolHeaderProps {
	file?: AttachmentItem
	extension?: string
	title?: string
	icon?: React.ReactNode
	suffix?: React.ReactNode
	showTitle?: boolean
	headerClassName?: string
}

function ToolHeader({
	file,
	extension,
	title,
	icon,
	suffix,
	showTitle = true,
	headerClassName,
}: ToolHeaderProps) {
	const { styles, cx } = useStyles()
	const { projectFilesStore } = useMessageListContext()

	return (
		<Flex
			className={cx(styles.commonHeader, headerClassName)}
			justify="space-between"
			align="center"
		>
			<Flex className={cx(styles.titleContainer)} gap={4} align="center">
				{showTitle && (
					<>
						<div className={styles.icon}>
							{icon ||
								(file ? (
									<FileResourceIcon
										presentation={resolveFilePresentation(file, {
											context: projectFilesStore?.filePresentationContext,
											index: projectFilesStore?.filePresentationIndex,
										})}
										size={20}
									/>
								) : (
									<MagicFileIcon size={20} type={extension} />
								))}
						</div>
						<span
							className={styles.title}
							title={typeof title === "string" ? title : undefined}
						>
							{title}
						</span>
					</>
				)}
				{suffix}
			</Flex>
		</Flex>
	)
}

export default observer(ToolHeader)
