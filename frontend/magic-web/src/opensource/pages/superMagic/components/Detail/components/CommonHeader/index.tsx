import type React from "react"
import { memo } from "react"
import { useStyles } from "./styles"
import { Flex } from "antd"
import ActionButtons from "./ActionButtons"
import { cx } from "antd-style"

interface CommonHeaderProps {
	icon?: React.ReactNode
	title?: React.ReactNode
	setUserSelectDetail?: (detail: any) => void
	type?: string
	currentAttachmentIndex?: number
	totalFiles?: number
	onClose?: () => void
	onPrevious?: () => void
	onNext?: () => void
	onFullscreen?: () => void
	onDownload?: () => void
	hasUserSelectDetail?: boolean
	isFromNode?: boolean
	isFullscreen?: boolean
}

export default memo(function CommonHeader(props: CommonHeaderProps) {
	const {
		icon,
		title,
		setUserSelectDetail,
		type,
		currentAttachmentIndex = -1,
		totalFiles = 0,
		onClose,
		onPrevious,
		onNext,
		onFullscreen,
		onDownload,
		hasUserSelectDetail = true,
		isFromNode,
		isFullscreen,
	} = props
	const { styles } = useStyles()

	return (
		<Flex className={styles.commonHeader} justify="space-between" align="center">
			<Flex
				className={cx(styles.titleContainer, {
					[styles.extentTitle]: isFromNode,
				})}
				gap={4}
				align="center"
			>
				<div className={styles.icon}>{icon}</div>
				<span
					className={styles.title}
					title={typeof title === "string" ? title : undefined}
				>
					{title}
				</span>
			</Flex>
			<ActionButtons
				type={type}
				currentAttachmentIndex={currentAttachmentIndex}
				totalFiles={totalFiles}
				onPrevious={onPrevious}
				onNext={onNext}
				onFullscreen={onFullscreen}
				onDownload={onDownload}
				onClose={onClose}
				setUserSelectDetail={setUserSelectDetail}
				hasUserSelectDetail={hasUserSelectDetail}
				isFromNode={isFromNode}
				isFullscreen={isFullscreen}
			/>
		</Flex>
	)
})
