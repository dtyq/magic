import { useEffect, useMemo, useRef, useState } from "react"
import CommonHeaderV2 from "@/opensource/pages/superMagic/components/Detail/components/CommonHeaderV2"
import CommonFooter from "../../components/CommonFooter"
import { useFileData } from "@/opensource/pages/superMagic/hooks/useFileData"
import { Flex, Button } from "antd"
import { IconEdit } from "@tabler/icons-react"
import { ActionButton } from "@/opensource/pages/superMagic/components/Detail/components/CommonHeader/components"
import { useMemoizedFn, useResponsive } from "ahooks"
import { useTranslation } from "react-i18next"
import {
	convertBinToDocument,
	createEditorView,
} from "@/opensource/components/onlyoffice-comp/lib/x2t"
import { initializeOnlyOffice } from "@/opensource/components/onlyoffice-comp/lib/utils"
import {
	setDocmentObj,
	getDocmentObj,
} from "@/opensource/components/onlyoffice-comp/lib/document-state"
import {
	editorManagerFactory,
	type EditorManager,
} from "@/opensource/components/onlyoffice-comp/lib/editor-manager"
import {
	ONLYOFFICE_EVENT_KEYS,
	FILE_TYPE,
	ONLYOFFICE_LANG_KEY,
	ONLYOFFICE_CONTAINER_CONFIG,
} from "@/opensource/components/onlyoffice-comp/lib/const"
import { onlyofficeEventbus } from "@/opensource/components/onlyoffice-comp/lib/eventbus"
import type { DetailUniverData } from "../../types"
import { MagicSpin } from "@/opensource/components/base"
import { useFileOperations } from "@/opensource/pages/superMagic/components/TopicFilesButton/hooks/useFileOperations"
import type { AttachmentItem } from "@/opensource/pages/superMagic/components/TopicFilesButton/hooks/types"

const bufferToString = (buffer: ArrayBuffer) => {
	const bytes = new Uint8Array(buffer)
	let binary = ""
	const chunkSize = 8192
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
		binary += String.fromCharCode(...chunk)
	}
	return btoa(binary)
}

const stringToBuffer = (string: string) => {
	const binary = atob(string)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes.buffer
}

interface OnlyOfficeViewerProps {
	data: DetailUniverData
	type: string
	currentIndex?: number
	onPrevious?: () => void
	onNext?: () => void
	onFullscreen?: () => void
	totalFiles?: number
	hasUserSelectDetail?: boolean
	isFromNode?: boolean
	file_extension?: string
	setUserSelectDetail?: (detail: any) => void
	onClose?: () => void
	isFullscreen?: boolean
	viewMode?: string
	onViewModeChange?: (mode: string) => void
	onCopy?: () => void
	onShare?: () => void
	onFavorite?: () => void
	isFavorited?: boolean
	baseShareUrl?: string
	currentFile?: any
	className?: string
	updatedAt?: string
	detailMode?: string
	showFileHeader?: boolean
	selectedProject?: any
	activeFileId?: string
	showFooter?: boolean
	isEditMode?: boolean
	setIsEditMode?: (mode: boolean) => void
	allowEdit?: boolean
	saveEditContent?: (
		content: string,
		file_id: string,
		enable_shadow: boolean,
		fetchFileVersions?: () => Promise<any>,
	) => Promise<void>
	attachments?: AttachmentItem[]
	selectedTopic?: any
	allowDownload?: boolean
}

function OnlyOfficeViewer(props: OnlyOfficeViewerProps) {
	const {
		data,
		type,
		onFullscreen,
		isFromNode,
		file_extension = "xlsx",
		isFullscreen,
		viewMode,
		onViewModeChange,
		onCopy,
		currentFile,
		className,
		updatedAt,
		detailMode,
		showFileHeader = true,
		selectedProject,
		activeFileId,
		showFooter,
		isEditMode,
		setIsEditMode,
		allowEdit,
		saveEditContent,
		attachments,
		selectedTopic,
		allowDownload,
	} = props

	const { file_name, file_id } = data

	const responsive = useResponsive()
	const isMobile = responsive.md === false
	const { t } = useTranslation("super")

	// 使用 useFileOperations hook 获取下载方法
	const { handleDownloadFile } = useFileOperations({
		attachments,
		selectedTopic,
		projectId: selectedProject?.id,
	})
	const {
		fileData,
		loading: fileDataLoading,
		fileVersion,
		changeFileVersion,
		fetchFileVersions,
		fileVersionsList,
		handleVersionRollback,
		isNewestVersion,
	} = useFileData({
		file_id,
		responseType: "arrayBuffer",
		activeFileId,
		updatedAt,
		isFromNode,
		isEditing: isEditMode,
	})

	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	// 初始状态应该是只读模式（除非明确传入 isEditMode=true）
	const [readOnly, setReadOnly] = useState(!isEditMode)
	const initializedRef = useRef(false)
	const containerRef = useRef<HTMLDivElement>(null)

	// 生成唯一的容器ID（基于 file_id）
	const containerId = `onlyoffice-${file_id}`
	// 获取对应的 EditorManager 实例
	const editorManagerRef = useRef<EditorManager | null>(null)
	const getEditorManager = useMemoizedFn(() => {
		if (!editorManagerRef.current) {
			editorManagerRef.current = editorManagerFactory.create(containerId)
		}
		return editorManagerRef.current
	})

	// 构造 currentFile，确保下载按钮可以显示
	const fileForDownload = currentFile || {
		id: file_id,
		name: file_name,
		type: type,
	}

	// 获取文件的 MIME type
	const getFileMimeType = () => {
		const extension = (file_extension || "").toLowerCase()
		if (["xlsx", "xls"].includes(extension)) {
			return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		} else if (extension === "csv") {
			return "text/csv"
		} else if (["docx"].includes(extension)) {
			return "application/vnd.openxmlformats-officedocument.wordprocessingml.document;charset=UTF-8"
		} else if (["pptx", "ppt"].includes(extension)) {
			return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
		} else if (extension === "txt") {
			return "text/plain"
		}
		return "application/octet-stream"
	}

	// 获取文件类型对应的 FILE_TYPE 常量
	const getFileTypeConstant = () => {
		const extension = (file_extension || "").toLowerCase()
		if (["docx", "doc"].includes(extension)) {
			return FILE_TYPE.DOCX
		} else if (["pptx", "ppt"].includes(extension)) {
			return FILE_TYPE.PPTX
		} else {
			return FILE_TYPE.XLSX
		}
	}

	const handleEdit = useMemoizedFn(() => {
		if (setIsEditMode) {
			setIsEditMode(true)
		}
		setReadOnly(false)
	})

	const handleSave = useMemoizedFn(async () => {
		try {
			const editorManager = getEditorManager()
			if (!editorManager.exists()) {
				throw new Error("编辑器未初始化")
			}

			const binData = await editorManager.export()
			const fileTypeConstant = getFileTypeConstant()
			const result = await convertBinToDocument(
				binData.binData,
				binData.fileName,
				fileTypeConstant,
				binData.media, // 传入媒体信息
			)

			// 将 ArrayBuffer 转换为 base64 字符串
			const dataStr = bufferToString(result.data)
			const enable_shadow = false
			await saveEditContent?.(dataStr, file_id, enable_shadow, fetchFileVersions)
		} catch (error) {
			console.error("保存文档失败:", error)
		}
		if (setIsEditMode) {
			setIsEditMode(false)
		}
		setReadOnly(true)
	})

	const handleCancel = useMemoizedFn(() => {
		if (setIsEditMode) {
			setIsEditMode(false)
		}
		setReadOnly(true)
	})

	const quitEditMode = useMemoizedFn(() => {
		if (setIsEditMode) {
			setIsEditMode(false)
		}
		setReadOnly(true)
	})

	// 判断是否显示下载按钮
	const shouldShowDownload = () => {
		const extension = (file_extension || "").toLowerCase()
		return ["xlsx", "xls", "csv", "docx", "doc", "pptx", "ppt"].includes(extension)
	}

	const canShowDownload = shouldShowDownload() && allowDownload !== false

	const headerActionConfig = useMemo(() => {
		const canShowEditControls =
			Boolean(setIsEditMode) &&
			Boolean(allowEdit) &&
			!isMobile &&
			Boolean(file_id) &&
			Boolean(isNewestVersion) &&
			(file_extension || "").toLowerCase() !== "csv"

		if (!canShowEditControls) {
			return undefined
		}

		return {
			customActions: [
				{
					key: "onlyoffice-edit-controls",
					zone: "primary" as const,
					render: (context) => (
						<Flex gap="small">
							{!isEditMode ? (
								<ActionButton
									icon={IconEdit}
									onClick={handleEdit}
									title={t("fileViewer.edit")}
									text={t("fileViewer.edit")}
									showText={context.showButtonText}
								/>
							) : (
								<>
									<Button type="primary" size="small" onClick={handleSave}>
										{t("fileViewer.save")}
									</Button>
									<Button size="small" onClick={handleCancel}>
										{t("fileViewer.cancel")}
									</Button>
								</>
							)}
						</Flex>
					),
				},
			],
		}
	}, [
		allowEdit,
		file_extension,
		file_id,
		handleCancel,
		handleEdit,
		handleSave,
		isEditMode,
		isMobile,
		isNewestVersion,
		setIsEditMode,
		t,
	])

	// 下载文件 - 使用 useFileOperations 的 handleDownloadFile
	const handleDownload = useMemoizedFn(async () => {
		try {
			await handleDownloadFile(file_id, undefined, file_extension)
		} catch (error) {
			console.error("下载文件失败:", error)
		}
	})

	// 创建或打开文档视图
	const handleView = useMemoizedFn(async (fileName: string, file?: File) => {
		setError(null)
		try {
			setDocmentObj({ fileName, file })
			await initializeOnlyOffice()
			const { fileName: currentFileName, file: currentFile } = getDocmentObj()
			const editorManager = getEditorManager()
			// 使用当前的 readOnly 状态，确保初始时是只读模式
			await createEditorView({
				file: currentFile,
				fileName: currentFileName,
				isNew: !currentFile,
				readOnly: readOnly,
				lang: ONLYOFFICE_LANG_KEY.ZH,
				containerId: containerId, // 传入唯一的容器ID
				editorManager: editorManager, // 传入对应的编辑器管理器实例
			})
		} catch (err) {
			setError(err instanceof Error ? err.message : "操作失败")
			console.error("Document operation failed:", err)
		}
	})

	// 监控 fileData 变化（来自 useFileData）
	useEffect(() => {
		if (!fileData) return

		const mimeType = getFileMimeType()
		const extension = (file_extension || "").toLowerCase()
		// 文本文件类型，不需要 base64 解码
		const isTextFile = ["csv", "txt"].includes(extension)

		if (fileData instanceof ArrayBuffer) {
			console.log(
				"🔍 [OnlyOfficeViewer] 收到 ArrayBuffer，大小:",
				fileData.byteLength,
				"bytes",
			)

			try {
				let file: File

				if (isTextFile) {
					// 文本文件：直接解码为 UTF-8 文本
					console.log("📝 [OnlyOfficeViewer] 检测到文本文件，直接解码为 UTF-8")
					const text = new TextDecoder("utf-8").decode(fileData)
					file = new File([text], file_name, { type: mimeType })
					console.log("✅ [OnlyOfficeViewer] 文本文件创建成功:", file.size, "bytes")
				} else {
					// 二进制文件：检查是否是 ZIP 格式
					let finalBuffer: ArrayBuffer

					if (fileData.byteLength >= 4) {
						const view = new DataView(fileData, 0, 4)
						const signature = view.getUint32(0, true)

						// ZIP 文件魔数: 0x504b0304 (PK\x03\x04)
						if (signature === 0x04034b50) {
							console.log(
								"✅ [OnlyOfficeViewer] 检测到 ZIP 文件头，直接使用二进制数据",
							)
							finalBuffer = fileData
						} else {
							// 不是 ZIP 文件，尝试 base64 解码（可能是 base64 编码的二进制数据）
							console.log("🔄 [OnlyOfficeViewer] 非 ZIP 文件，尝试 base64 解码")
							try {
								const text = new TextDecoder("utf-8").decode(fileData)
								// 验证是否是有效的 base64 字符串
								const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
								if (base64Regex.test(text.trim())) {
									const decodedBuffer = stringToBuffer(text)
									finalBuffer = decodedBuffer
									console.log("✅ [OnlyOfficeViewer] base64 解码成功")
								} else {
									// 不是 base64，直接使用原始数据
									console.log(
										"⚠️ [OnlyOfficeViewer] 不是 base64 编码，直接使用原始数据",
									)
									finalBuffer = fileData
								}
							} catch (decodeError) {
								// base64 解码失败，直接使用原始数据
								console.log(
									"⚠️ [OnlyOfficeViewer] base64 解码失败，使用原始数据:",
									decodeError,
								)
								finalBuffer = fileData
							}
						}
					} else {
						// 数据太小，直接使用
						finalBuffer = fileData
					}

					// 创建 File 对象
					file = new File([finalBuffer], file_name, { type: mimeType })
					console.log("🚀 [OnlyOfficeViewer] File 创建成功:", file.size, "bytes")
				}

				setLoading(true)
				handleView(file_name, file)
				return
			} catch (error) {
				console.error("❌ [OnlyOfficeViewer] 解析文件数据失败:", error)
				setError("解析文件数据失败")
				setLoading(false)
			}
		} else if (typeof fileData === "string") {
			// 对于文本文件，创建 File 对象
			const file = new File([fileData], file_name, {
				type: mimeType,
			})
			setLoading(true)
			handleView(file_name, file)
		} else if (fileData) {
			// 如果是其他类型的数据，转换为 File 对象
			const file = new File([fileData], file_name, {
				type: mimeType,
			})
			setLoading(true)
			handleView(file_name, file)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fileData, file_name, file_extension])

	// 初始化 OnlyOffice
	useEffect(() => {
		const init = async () => {
			try {
				await initializeOnlyOffice()
				const editorManager = getEditorManager()
				if (!initializedRef.current && !editorManager.exists()) {
					initializedRef.current = true
				}
			} catch (err) {
				console.error("Failed to initialize OnlyOffice:", err)
				setError("无法加载编辑器组件")
			}
		}

		init()

		// 监听文档准备就绪事件
		onlyofficeEventbus.on(ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY, () => {
			setLoading(false)
		})

		// 监听 loading 状态变化
		// const handleLoadingChange = (data: { loading: boolean }) => {
		// 	setLoading(data.loading)
		// }
		// onlyofficeEventbus.on(ONLYOFFICE_EVENT_KEYS.LOADING_CHANGE, handleLoadingChange)

		return () => {
			// onlyofficeEventbus.off(ONLYOFFICE_EVENT_KEYS.LOADING_CHANGE, handleLoadingChange)
			// 销毁对应的编辑器实例
			const editorManager = getEditorManager()
			editorManager.destroy()
			// 也可以使用工厂方法销毁：editorManagerFactory.destroy(containerId)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// 同步 isEditMode 和 readOnly 状态
	useEffect(() => {
		const newReadOnly = !isEditMode
		setReadOnly(newReadOnly)
		// 如果编辑器已存在，同步更新编辑器的只读状态
		const editorManager = getEditorManager()
		if (editorManager.exists()) {
			editorManager.setReadOnly(newReadOnly).catch((err) => {
				console.error("切换只读模式失败:", err)
			})
		}
	}, [isEditMode, getEditorManager])

	return (
		<div
			style={{ height: "100%", display: "flex", flexDirection: "column" }}
			className={className}
		>
			{showFileHeader && (
				<CommonHeaderV2
					type={type}
					onFullscreen={onFullscreen}
					onDownload={canShowDownload ? handleDownload : undefined}
					showDownload={canShowDownload}
					isFromNode={isFromNode}
					isFullscreen={isFullscreen}
					viewMode={viewMode as "code" | "desktop" | "phone" | undefined}
					onViewModeChange={onViewModeChange}
					onCopy={onCopy}
					currentFile={fileForDownload}
					detailMode={detailMode as "single" | "files" | undefined}
					fileVersion={fileVersion}
					isNewestFileVersion={isNewestVersion}
					changeFileVersion={changeFileVersion}
					fileVersionsList={fileVersionsList}
					handleVersionRollback={handleVersionRollback}
					quitEditMode={quitEditMode}
					allowEdit={allowEdit}
					isEditMode={isEditMode}
					attachments={attachments}
					actionConfig={headerActionConfig}
				/>
			)}

			{/* 错误提示 */}
			{error && (
				<div className="mx-4 mt-4 rounded border-l-4 border-red-500 bg-red-50 p-4 text-red-700">
					<p className="font-medium">错误：{error}</p>
				</div>
			)}

			{/* 编辑器容器 - 必须一直在 DOM 中，OnlyOffice 需要它 */}
			{/* 添加 onlyoffice-container class 和 data-onlyoffice-container-id 属性，确保多实例正确定位 */}
			<div
				ref={containerRef}
				className={ONLYOFFICE_CONTAINER_CONFIG.PARENT_CLASS_NAME}
				data-onlyoffice-container-id={containerId}
				style={{
					flex: 1,
					overflow: "hidden",
					minHeight: "500px",
					position: "relative",
				}}
			>
				{/* OnlyOffice 容器元素 - 必须一直存在，不能移除 */}
				{/* 使用 visibility 而不是 display，确保元素始终在 DOM 中 */}
				<div
					id={containerId}
					style={{
						position: "absolute",
						inset: 0,
						zIndex: -999,
						visibility: fileDataLoading || loading || !fileData ? "hidden" : "visible",
						opacity: fileDataLoading || loading || !fileData ? 0 : 1,
						pointerEvents: fileDataLoading || loading || !fileData ? "none" : "auto",
					}}
				/>
				{/* 加载遮罩 - 覆盖在容器上方 */}
				{(fileDataLoading || loading || !fileData) && (
					<div
						style={{
							height: "100%",
							width: "100%",
							position: "absolute",
							inset: 0,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: "rgba(255, 255, 255, 0.9)",
							padding: "16px",
						}}
					>
						<MagicSpin spinning size="default" />
					</div>
				)}
			</div>

			{/* 底部 */}
			{showFooter && (
				<CommonFooter
					fileVersion={fileVersion}
					changeFileVersion={changeFileVersion}
					fileVersionsList={fileVersionsList}
					handleVersionRollback={handleVersionRollback}
					quitEditMode={quitEditMode}
					allowEdit={allowEdit}
					isEditMode={false}
				/>
			)}
		</div>
	)
}

export default OnlyOfficeViewer
