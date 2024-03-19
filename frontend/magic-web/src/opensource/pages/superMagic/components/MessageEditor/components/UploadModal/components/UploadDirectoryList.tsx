import { useTranslation } from "react-i18next"
import { IconTrash, IconChevronDown, IconChevronRight } from "@tabler/icons-react"
import { useState } from "react"

import { useStyles } from "./UploadFileList/styles"
import MagicFileIcon from "@/opensource/components/base/MagicFileIcon"
import SmartTooltip from "@/opensource/components/other/SmartTooltip"

interface FileItem {
	name: string
	file: File
}

interface DirectoryNode {
	name: string
	type: "file" | "directory"
	file?: File
	children?: DirectoryNode[]
	path: string
}

interface UploadDirectoryListProps {
	fileList: FileItem[]
	onRemoveFile?: (index: number) => void
}

function UploadDirectoryList({ fileList, onRemoveFile }: UploadDirectoryListProps) {
	const { t } = useTranslation("super")
	const { styles } = useStyles()
	const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

	// 构建目录树结构
	const buildDirectoryTree = (files: FileItem[]): DirectoryNode[] => {
		const root: DirectoryNode[] = []
		const pathMap = new Map<string, DirectoryNode>()

		files.forEach((fileItem) => {
			const { file } = fileItem
			const relativePath = file.webkitRelativePath || file.name
			const pathParts = relativePath.split("/")

			let currentLevel = root
			let currentPath = ""

			pathParts.forEach((part, index) => {
				currentPath = currentPath ? `${currentPath}/${part}` : part
				const isFile = index === pathParts.length - 1

				let existingNode = currentLevel.find((node) => node.name === part)

				if (!existingNode) {
					const newNode: DirectoryNode = {
						name: part,
						type: isFile ? "file" : "directory",
						children: isFile ? undefined : [],
						path: currentPath,
						file: isFile ? file : undefined,
					}

					currentLevel.push(newNode)
					pathMap.set(currentPath, newNode)
					existingNode = newNode
				}

				if (!isFile && existingNode.children) {
					currentLevel = existingNode.children
				}
			})
		})

		return root
	}

	const directoryTree = buildDirectoryTree(fileList)

	// 切换展开/折叠状态
	const toggleExpanded = (path: string) => {
		setExpandedNodes((prev) => {
			const newSet = new Set(prev)
			if (newSet.has(path)) {
				newSet.delete(path)
			} else {
				newSet.add(path)
			}
			return newSet
		})
	}

	// 获取文件在原始列表中的索引
	const getFileIndex = (file: File) => {
		return fileList.findIndex((item) => item.file === file)
	}

	// 渲染目录树节点
	const renderNode = (node: DirectoryNode, depth: number = 0): React.ReactNode => {
		const isExpanded = expandedNodes.has(node.path)
		const paddingLeft = depth * 20

		if (node.type === "file" && node.file) {
			const fileIndex = getFileIndex(node.file)
			const extension = node.name.split(".").pop()

			return (
				<div key={node.path} className={styles.fileItem} style={{ paddingLeft }}>
					<div className={styles.fileInfo}>
						<MagicFileIcon type={extension} className={styles.fileIcon} />
						<SmartTooltip className={styles.fileName}>{node.name}</SmartTooltip>
					</div>

					<div className={styles.actions}>
						{onRemoveFile && fileIndex !== -1 && (
							<button
								className={`${styles.actionButton} delete`}
								onClick={() => onRemoveFile(fileIndex)}
								title={t("uploadModal.removeFile")}
							>
								<IconTrash size={18} />
							</button>
						)}
					</div>
				</div>
			)
		} else if (node.type === "directory" && node.children) {
			return (
				<div key={node.path}>
					<div
						className={`${styles.fileItem} ${styles.directoryItem}`}
						style={{ paddingLeft }}
						onClick={() => toggleExpanded(node.path)}
					>
						<div className={styles.fileInfo}>
							<span className={styles.expandIcon}>
								{isExpanded ? (
									<IconChevronDown size={16} />
								) : (
									<IconChevronRight size={16} />
								)}
							</span>
							<MagicFileIcon type="folder" className={styles.fileIcon} />
							<SmartTooltip className={styles.fileName}>{node.name}</SmartTooltip>
						</div>
					</div>

					{isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
				</div>
			)
		}

		return null
	}

	// 计算总文件数
	const totalFiles = fileList.length

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<div className={styles.headerTitle}>
					{t("uploadModal.folderToUpload")} ({totalFiles} {t("uploadModal.files")})
				</div>
			</div>

			<div className={styles.fileList}>{directoryTree.map((node) => renderNode(node))}</div>
		</div>
	)
}

export default UploadDirectoryList
