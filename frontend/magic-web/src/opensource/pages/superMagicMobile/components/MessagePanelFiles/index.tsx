import MagicFileIcon from "@/opensource/components/base/MagicFileIcon"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import type { FileItem } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { formatFileSize } from "@/opensource/utils/string"
import { IconX } from "@tabler/icons-react"
import { createStyles, cx } from "antd-style"
import { memo } from "react"

interface MessagePanelFilesProps {
	className?: string
	style?: React.CSSProperties
	fileList?: FileItem[]
	onFileListChange?: (files: FileItem[]) => void
}

const useStyles = createStyles(({ token }) => ({
	files: {
		display: "flex",
		flexWrap: "wrap",
		gap: 4,
		marginBottom: 8,
	},
	item: {
		display: "flex",
		alignItems: "center",
		padding: "0px 8px",
		borderRadius: token.borderRadiusSM,
		fontSize: token.fontSizeSM,
		position: "relative",
		border: `1px solid ${token.colorBorder}`,
		fontWeight: 400,
		height: 32,
	},
	content: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	name: {
		marginLeft: 4,
		maxWidth: 100,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	size: {
		color: token.magicColorUsages.text[3],
		marginLeft: 4,
	},
	deleteIcon: {
		marginLeft: 8,
		color: "white",
		background: token.colorError,
		width: 14,
		height: 14,
		borderRadius: "50%",
		cursor: "pointer",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		"&:active": {
			opacity: 0.8,
		},
	},
}))

export default memo(function MessagePanelFiles(props: MessagePanelFilesProps) {
	const { className, style, fileList, onFileListChange } = props
	const { styles } = useStyles()

	const getFileType = (fileName: string) => {
		const fileType = fileName.split(".").pop()
		return fileType
	}

	if (!fileList?.length) {
		return null
	}

	return (
		<div className={cx(styles.files, className)} style={style}>
			{fileList.map((item) => {
				return (
					<div key={item.file_key} className={styles.item}>
						<div className={styles.content}>
							<MagicFileIcon type={getFileType(item.file_name)} size={14} />
							<span className={styles.name}>{item.file_name}</span>
							<span className={styles.size}>{formatFileSize(item.file_size)}</span>
						</div>
						<div
							className={styles.deleteIcon}
							onClick={() => {
								onFileListChange?.(
									fileList.filter((file) => file.file_key !== item.file_key),
								)
							}}
						>
							<MagicIcon
								component={IconX}
								size={10}
								stroke={2}
								style={{ stroke: "white" }}
							/>
						</div>
					</div>
				)
			})}
		</div>
	)
})
