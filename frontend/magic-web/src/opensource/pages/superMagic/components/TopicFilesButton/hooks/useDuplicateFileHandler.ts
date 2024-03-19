import { useState, useCallback, useRef } from "react"
import type { AttachmentItem } from "./types"
import {
	detectDuplicateFiles,
	generateRenameMapForDuplicates,
	renameFilesForUpload,
	extractCommonFolderPath,
} from "../utils/duplicateFileHandler"
import { UserChoice, type UserChoiceType } from "./duplicateFileConstants"

interface UseDuplicateFileHandlerOptions {
	attachments: AttachmentItem[]
}

export function useDuplicateFileHandler({ attachments }: UseDuplicateFileHandlerOptions) {
	// Modal 状态
	const [modalVisible, setModalVisible] = useState(false)
	const [currentFileName, setCurrentFileName] = useState("")

	// 当前处理状态
	const [pendingFiles, setPendingFiles] = useState<File[]>([])
	const [originalUploadPath, setOriginalUploadPath] = useState("") // 原始上传路径（传给 createUploadTask）
	const [targetPath, setTargetPath] = useState("") // 实际检测路径（用于同名检测和重命名）
	const [folderPath, setFolderPath] = useState("") // 提取的文件夹路径（用于显示）
	const [duplicateFiles, setDuplicateFiles] = useState<Map<string, File>>(new Map())
	const [currentIndex, setCurrentIndex] = useState(0)
	const [renameMap, setRenameMap] = useState<Map<string, string>>(new Map())

	// 使用 ref 存储当前的上传回调
	const onFilesProcessedRef = useRef<
		((files: File[], targetPath: string) => Promise<void>) | null
	>(null)

	/**
	 * 处理单个文件的用户选择
	 */
	const handleUserChoice = useCallback(
		async (choice: UserChoiceType, applyToAll: boolean) => {
			setModalVisible(false)

			// 用户取消
			if (choice === UserChoice.CANCEL) {
				// 清空状态
				setPendingFiles([])
				setOriginalUploadPath("")
				setTargetPath("")
				setFolderPath("")
				setDuplicateFiles(new Map())
				setCurrentIndex(0)
				setRenameMap(new Map())
				return
			}

			// applyToAll 将影响后续处理逻辑

			// 使用局部变量跟踪最新的 renameMap，避免 setState 异步问题
			const currentRenameMap = new Map(renameMap)

			// 处理当前文件（需要同时获取 key 和 value）
			const currentFileRelativePath = Array.from(duplicateFiles.keys())[currentIndex]
			const currentFile = Array.from(duplicateFiles.values())[currentIndex]

			if (currentFile && currentFileRelativePath) {
				if (choice === UserChoice.KEEP_BOTH) {
					// 需要重命名
					// 使用相对路径作为 key（而不是 file.name）
					const singleFileMap = new Map([[currentFileRelativePath, currentFile]])
					const singleRenameMap = generateRenameMapForDuplicates(
						singleFileMap,
						targetPath,
						attachments,
					)
					console.log(
						`🔧 [handleUserChoice] 单个文件重命名映射:`,
						Array.from(singleRenameMap.entries()),
					)
					singleRenameMap.forEach((newName, oldName) => {
						currentRenameMap.set(oldName, newName)
					})
					setRenameMap(currentRenameMap)
				}
				// 如果是 replace，不需要做任何处理，直接使用原文件名
			}

			const nextIndex = currentIndex + 1

			// 处理所有文件的内部函数
			const processAllFiles = async (currentRenameMap: Map<string, string>) => {
				// 应用重命名
				const finalFiles = renameFilesForUpload(pendingFiles, currentRenameMap)

				console.log("📤 [processAllFiles] 准备上传文件:")
				console.log("  ↳ originalUploadPath:", originalUploadPath)
				console.log("  ↳ finalFiles 详情:")
				finalFiles.forEach((file) => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const webkitPath = (file as any).webkitRelativePath || ""
					console.log(`    - name="${file.name}", webkitRelativePath="${webkitPath}"`)
				})

				// 清空状态
				setPendingFiles([])
				setOriginalUploadPath("")
				setTargetPath("")
				setFolderPath("")
				setDuplicateFiles(new Map())
				setCurrentIndex(0)
				setRenameMap(new Map())

				// 调用上传回调（使用原始上传路径，不是检测路径）
				if (onFilesProcessedRef.current) {
					await onFilesProcessedRef.current(finalFiles, originalUploadPath)
				}
			}

			// 检查是否还有更多同名文件需要处理
			if (nextIndex < duplicateFiles.size) {
				setCurrentIndex(nextIndex)

				// 如果是 "ask-each" 模式，显示下一个文件的弹窗
				if (!applyToAll) {
					const nextFileRelativePath = Array.from(duplicateFiles.keys())[nextIndex]
					// 如果有文件夹路径，拼接显示完整路径
					const displayFileName = folderPath
						? `${folderPath}/${nextFileRelativePath}`
						: nextFileRelativePath
					setCurrentFileName(displayFileName)
					setModalVisible(true)
				} else {
					// 如果是 "apply-to-all" 模式，自动处理剩余文件
					if (choice === UserChoice.KEEP_BOTH) {
						// 为所有剩余文件生成重命名映射
						const remainingDuplicates = new Map<string, File>()
						Array.from(duplicateFiles.entries())
							.slice(nextIndex)
							.forEach(([name, file]) => {
								remainingDuplicates.set(name, file)
							})

						const remainingRenameMap = generateRenameMapForDuplicates(
							remainingDuplicates,
							targetPath,
							attachments,
						)
						remainingRenameMap.forEach((newName, oldName) => {
							currentRenameMap.set(oldName, newName)
						})
						setRenameMap(currentRenameMap)

						// 处理所有文件
						await processAllFiles(currentRenameMap)
					} else {
						// 处理所有文件（Replace All）
						await processAllFiles(currentRenameMap)
					}
				}
			} else {
				// 所有同名文件都已处理完，执行上传
				await processAllFiles(currentRenameMap)
			}
		},
		[
			currentIndex,
			duplicateFiles,
			renameMap,
			targetPath,
			originalUploadPath,
			folderPath,
			attachments,
			pendingFiles,
		],
	)

	/**
	 * 主流程：检测同名并处理
	 * @param files 要上传的文件列表
	 * @param path 目标路径
	 * @param onFilesProcessed 实际的文件上传回调函数
	 */
	const handleFilesWithDuplicateCheck = useCallback(
		async (
			files: File[],
			path: string,
			onFilesProcessed: (files: File[], targetPath: string) => Promise<void>,
		) => {
			console.log("🔍 [DuplicateHandler] 开始检测同名文件", { originalPath: path })

			// 保存上传回调到 ref
			onFilesProcessedRef.current = onFilesProcessed

			// 提取文件夹路径（如果是文件夹上传）
			const folderPath = extractCommonFolderPath(files)

			// 计算实际的目标路径
			// 如果是文件夹上传（有 folderPath），需要在 path 后面加上文件夹名
			const actualTargetPath = folderPath
				? path
					? `${path}/${folderPath}`
					: folderPath
				: path

			console.log("🔍 [DuplicateHandler] 路径信息:", {
				originalPath: path,
				extractedFolderPath: folderPath,
				actualTargetPath,
			})

			// 在实际的目标路径下检测同名文件
			const duplicates = detectDuplicateFiles(files, actualTargetPath, attachments)

			console.log("🔍 [DuplicateHandler] 检测结果:", {
				duplicatesCount: duplicates.size,
				duplicateNames: Array.from(duplicates.keys()),
			})

			// 如果没有同名文件，直接上传
			if (duplicates.size === 0) {
				console.log("✅ [DuplicateHandler] 无同名文件，直接上传")
				await onFilesProcessed(files, path)
				return
			}

			// 有同名文件，进入处理流程
			console.log("⚠️ [DuplicateHandler] 发现同名文件，准备显示 Modal")
			setPendingFiles(files)
			setOriginalUploadPath(path) // 保存原始上传路径（传给 createUploadTask）
			setTargetPath(actualTargetPath) // 保存实际检测路径（用于同名检测和重命名）
			setFolderPath(folderPath) // 保存文件夹路径（用于显示）
			setDuplicateFiles(duplicates)
			setCurrentIndex(0)
			setRenameMap(new Map())

			// 显示第一个同名文件的弹窗
			const firstFileRelativePath = Array.from(duplicates.keys())[0]
			// 如果有文件夹路径，拼接显示完整路径
			const displayFileName = folderPath
				? `${folderPath}/${firstFileRelativePath}`
				: firstFileRelativePath
			setCurrentFileName(displayFileName)
			setModalVisible(true)

			console.log("📱 [DuplicateHandler] Modal 状态已设置:", {
				fileName: displayFileName,
				shouldShowModal: true,
			})
		},
		[attachments],
	)

	/**
	 * Modal 回调：用户选择覆盖
	 */
	const handleReplace = useCallback(
		(applyToAll: boolean) => {
			handleUserChoice("replace", applyToAll)
		},
		[handleUserChoice],
	)

	/**
	 * Modal 回调：用户选择保留两者
	 */
	const handleKeepBoth = useCallback(
		(applyToAll: boolean) => {
			handleUserChoice("keep-both", applyToAll)
		},
		[handleUserChoice],
	)

	/**
	 * Modal 回调：用户取消
	 */
	const handleCancel = useCallback(() => {
		handleUserChoice("cancel", false)
	}, [handleUserChoice])

	return {
		// 主方法
		handleFilesWithDuplicateCheck,

		// Modal 状态
		modalVisible,
		currentFileName,
		totalDuplicates: duplicateFiles.size,

		// Modal 回调
		handleReplace,
		handleKeepBoth,
		handleCancel,
	}
}
