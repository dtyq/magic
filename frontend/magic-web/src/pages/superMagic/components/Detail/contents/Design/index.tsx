import CanvasDesign from "@/components/CanvasDesign"
// import CanvasDesignHeader from "./components/CanvasDesignHeader"
import { createStyles } from "antd-style"
import { useState, useCallback, useRef, useEffect, lazy, Suspense, useMemo } from "react"
import { DesignData } from "./types"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { Topic, ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import MagicSpin from "@/components/base/MagicSpin"
import { useTranslation } from "react-i18next"
import useShareRoute from "@/pages/superMagic/hooks/useShareRoute"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useDesignMethods } from "./hooks/useDesignMethods"
import { useConversationAndDownload } from "./hooks/useConversationAndDownload"
import { useDesignMarker } from "./hooks/useDesignMarker"
import pubsub from "@/utils/pubsub"
import { useSuperMagicMarkerManager } from "./marker-manager"
import { useDesignProjectManager } from "./hooks/useDesignProjectManager"
import {
	getDesignDirectoryInfo,
	fileItemsToProjectAttachmentMentionTree,
	normalizeMentionFolderId,
	resolveDesignProjectBasePathFromAttachments,
} from "./utils/utils"
import { FlexBox } from "@/components/base"
import { observer } from "mobx-react-lite"
import workspaceStore from "@/pages/superMagic/stores/core/workspace"
import type { CanvasDesignRef } from "@/components/CanvasDesign/types"
import { useDesignFocusElement } from "./hooks/useDesignFocusElement"
import { useAttachments } from "./hooks/useAttachments"
import { useCanvasImageFileRenameSync } from "./hooks/useCanvasImageFileRenameSync"
import type { CanvasDocument, LayerElement } from "@/components/CanvasDesign/canvas/types"
import CanvasDesignHeaderV2 from "./components/CanvasDesignHeaderV2"
import { useDesignHeaderProps } from "./components/CanvasDesignHeaderV2/useDesignHeaderProps"
import { CanvasDesignMentionDataService } from "./adapters/CanvasDesignMentionDataService"
import { CanvasDesignReferenceResourcePanel } from "./adapters/CanvasDesignReferenceResourcePanel"
import { MentionExtension } from "@/components/business/MentionPanel/tiptap-plugin"
import { useDesignDownloadPolicy } from "./hooks/useDesignDownloadPolicy"
import { HISTORY_VERSION_BANNER_LAYOUT_HEIGHT_PX } from "@/pages/superMagic/components/Detail/components/CommonHeader/components/HistoryVersionBanner"
import { useAiWatermarkPreference } from "@/hooks/useAiWatermarkPreference"
import { getDesignProjectCurrentFileByProjectPath } from "./utils/toolDesignProjectInfo"
import type { DesignRemoteUpdateListenerMode } from "./managers/types"
import { useCanvasResourceRefresh } from "./hooks/useCanvasResourceRefresh"

// 懒加载协议弹窗
const loadWaterMarkFreeModal = async () => {
	const module = await import("@/pages/superMagic/components/WaterMarkFreeModal")
	return {
		default: module.WaterMarkFreeModal,
	}
}

const WaterMarkFreeModal = lazy(() => loadWaterMarkFreeModal())

const DESIGN_REMOTE_UPDATE_LISTENER_MODE: DesignRemoteUpdateListenerMode = "file-change" as const

const useStyles = createStyles({
	designViewerContainer: {
		width: "100%",
		height: "100%",
		display: "flex",
		flexDirection: "column",
		position: "relative",
	},
	designCanvasContainer: {
		flex: 1,
		width: "100%",
		height: "100%",
		position: "relative",
	},
	revokeOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: "rgba(255, 255, 255, 0.3)",
		backdropFilter: "blur(2px)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		zIndex: 1000,
		pointerEvents: "all",
	},
	revokeOverlayContent: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		gap: "16px",
		color: "#fff",
	},
})

interface DesignViewerProps {
	attachments?: FileItem[]
	attachmentList?: FileItem[]
	currentFile?: {
		id: string
		name: string
		type: string
		url?: string
		projectId?: string
		projectName?: string
	}
	selectedTopic?: Topic | null
	selectedProject?: ProjectListItem | null
	/** 是否为话题回放模式 */
	isPlaybackMode?: boolean
	allowEdit: boolean
	showFileHeader: boolean
	showFooter: boolean
	allowDownload?: boolean
	data?: {
		project_path?: string
		elements?: LayerElement[]
	}
}

function DesignViewer(props: DesignViewerProps) {
	const {
		attachments,
		attachmentList,
		currentFile: currentFileProps,
		selectedTopic,
		selectedProject,
		isPlaybackMode = false,
		allowEdit,
		showFileHeader,
		allowDownload,
	} = props

	const propsElements = props.data?.elements

	const { styles } = useStyles()
	const { t } = useTranslation("super")
	const { t: canvasDesignT } = useTranslation("canvasDesign")
	const { i18n } = useTranslation()

	const hostUiLocale = i18n.resolvedLanguage ?? i18n.language

	// 获取项目 ID
	const projectId = selectedTopic?.project_id

	const currentFile = useMemo(() => {
		const projectPath = props.data?.project_path
		if (isPlaybackMode && projectPath) {
			const designProjectFile = getDesignProjectCurrentFileByProjectPath({
				projectPath,
				attachments,
			})
			if (designProjectFile) return designProjectFile
		}
		return currentFileProps
	}, [attachments, currentFileProps, isPlaybackMode, props.data?.project_path])

	// 从 store 获取 selectedWorkspace（参考文件列表的实现）
	const selectedWorkspace = workspaceStore.selectedWorkspace

	// 检测是否是分享场景
	const { isShareRoute } = useShareRoute()

	// 检测是否是移动端
	const isMobile = useIsMobile()

	// 用于强制重新挂载 CanvasDesign 的 key
	const [canvasDesignKey, setCanvasDesignKey] = useState(0)

	const refreshCanvasDesign = useCallback(() => {
		setCanvasDesignKey((prev) => prev + 1)
	}, [])

	const prevDesignProjectBasePathRef = useRef<string | undefined>(undefined)

	// 文件列表更新处理
	const { flatAttachments, attachmentIndex, updateAttachments } = useAttachments({
		attachments,
		attachmentList,
	})

	// 获取目录信息
	const directoryInfo = useMemo(() => {
		return getDesignDirectoryInfo(currentFile, attachments)
	}, [currentFile, attachments])

	const defaultProjectAttachmentFolderId = useMemo(() => {
		return normalizeMentionFolderId(directoryInfo.path) || directoryInfo.id || undefined
	}, [directoryInfo.id, directoryInfo.path])

	const defaultProjectAttachmentFolderName = useMemo(() => {
		return directoryInfo.name || undefined
	}, [directoryInfo.name])

	// 相对于根目录的路径, 例如 "新建文件夹/新建画布"
	const designProjectBasePath = resolveDesignProjectBasePathFromAttachments({
		currentFile,
		flatAttachments,
		attachments,
	})

	// 与 MessageEditor @ 同源：整棵附件树（保留目录层级，由 MentionPanel 展开）
	const projectAttachmentMentionTree = useMemo(
		() => fileItemsToProjectAttachmentMentionTree(attachments, designProjectBasePath),
		[attachments, designProjectBasePath],
	)

	// CanvasDesign ref（需在 designProjectManager 之前，onRemoteDesignDataUpdate 回调中使用）
	const canvasDesignRef = useRef<CanvasDesignRef | null>(null)
	const isApplyingRemoteCanvasUpdateRef = useRef(false)

	// 用于跟踪是否已经执行过初始加载，确保只加载一次
	// 这样可以避免 attachments 数组引用变化导致的重复加载
	const hasLoadedRef = useRef(false)

	// magic.project.js 与 designData 集中管理器（含 autoSave、远端更新监听、版本管理）
	const designProjectManager = useDesignProjectManager({
		currentFile,
		attachments,
		flatAttachments,
		attachmentIndex,
		projectId,
		allowEdit,
		isPlaybackMode,
		isShareRoute,
		isMobile,
		projectPath: props.data?.project_path,
		designProjectId: directoryInfo.id || currentFile?.id,
		designProjectName: directoryInfo.name ?? "",
		selectedTopicId: selectedTopic?.id,
		remoteUpdateListenerMode: DESIGN_REMOTE_UPDATE_LISTENER_MODE,
		onRemoteDesignDataUpdate: useCallback(
			(_oldDesignData: DesignData, newDesignData: DesignData) => {
				if (newDesignData.canvas) {
					isApplyingRemoteCanvasUpdateRef.current = true
					try {
						canvasDesignRef.current?.updateData(newDesignData.canvas)
					} finally {
						isApplyingRemoteCanvasUpdateRef.current = false
					}
				}
				// 暂时注释掉focus调试效果
				// const diff =
				// 	updateType === "message"
				// 		? compareDesignData(oldDesignData, newDesignData)
				// 		: null
				// if (updateType === "message" && diff && diff.added.length > 0) {
				// const firstAdded = diff.added[0]
				// setTimeout(() => {
				// 	canvasDesignRef.current?.focusElement([firstAdded.elementId], {
				// 		animated: true,
				// 		selectElement: false,
				// 		panOnly: true,
				// 		padding: { top: "25%", right: "25%", bottom: "25%", left: "25%" },
				// 	})
				// }, 300)
				// }
			},
			[],
		),
		onVersionChange: useCallback(
			(_designData: DesignData, isViewingHistory: boolean) => {
				refreshCanvasDesign()
				if (isViewingHistory) refreshCanvasDesign()
			},
			[refreshCanvasDesign],
		),
	})

	const {
		designData,
		updateDesignDataAndScheduleSave,
		magicProjectJsFileId,
		isInitialLoading,
		// isSaving - 迁移后不再用于头部保存状态指示器，暂时注释掉，如需使用可取消注释
		loadFromRemote,
		resetAndReload,
		isReadOnly: isReadOnlyState,
		setIsReadOnly: setIsReadOnlyState,
		fileVersionsList,
		fileVersion,
		isNewestVersion,
		handleChangeFileVersion,
		handleReturnLatest,
		handleVersionRollback,
		fetchFileVersions,
	} = designProjectManager

	const { isProcessingRevoke, revokeType } = designProjectManager

	// 当 designProjectBasePath 变化（目录改名）时，重新从远端加载 DSL（修复旧路径引用），再重挂载画布
	useEffect(() => {
		if (prevDesignProjectBasePathRef.current === undefined) {
			prevDesignProjectBasePathRef.current = designProjectBasePath
			return
		}

		if (prevDesignProjectBasePathRef.current !== designProjectBasePath) {
			prevDesignProjectBasePathRef.current = designProjectBasePath
			resetAndReload().then(() => refreshCanvasDesign())
		}
	}, [designProjectBasePath, refreshCanvasDesign, resetAndReload])

	// 设计容器 ref
	const containerRef = useRef<HTMLDivElement>(null)

	// 获取显示名称，优先使用目录名称
	const displayName = directoryInfo.name || designData.name

	// 设计项目 ID
	const designProjectId = directoryInfo.id || currentFile?.id || ""

	const downloadPolicy = useDesignDownloadPolicy()
	const { isFreeTrialVersion } = useAiWatermarkPreference()

	const designCanvasMagicPermissions = useMemo(
		() => ({
			...downloadPolicy.permissions,
			isFreeTrialVersion,
			elementMenuConversationActions: isNewestVersion && !isShareRoute,
		}),
		[downloadPolicy.permissions, isFreeTrialVersion, isNewestVersion, isShareRoute],
	)

	const {
		waterMarkFreeModalVisible,
		setWaterMarkFreeModalVisible,
		downloadFileElements,
		setDownloadFileElements,
		waterMarkFreeModalInitialized,
	} = downloadPolicy

	// 退出全屏函数
	const handleExitFullscreen = useCallback(async () => {
		if (document.fullscreenElement) {
			try {
				await document.exitFullscreen()
			} catch (error) {
				//
			}
		}
	}, [])

	// 获取 executeDownload 方法（用于协议弹窗确认后的直接下载）
	const { executeDownload } = useConversationAndDownload({
		flatAttachments,
		designProjectBasePath,
		selectedWorkspace,
		selectedProject,
		afterAddFileToCurrentTopic: undefined,
		afterAddFileToNewTopic: undefined,
		onExitFullscreen: handleExitFullscreen,
		downloadPolicy,
	})

	// 使用 SuperMagic Marker Manager（需在 useDesignMethods 之前）
	const markerManager = useSuperMagicMarkerManager()

	// 缓存 markers 避免每次 render 都调用 getMarkers
	const [markersForCanvas, setMarkersForCanvas] = useState(() => {
		return markerManager.getMarkers(designProjectId ?? "")
	})

	// 使用 hook 获取 methods 方法集合
	const methods = useDesignMethods({
		projectId,
		designProjectId,
		selectedTopic,
		currentFile,
		flatAttachments,
		attachmentIndex,
		selectedProject,
		selectedWorkspace,
		onExitFullscreen: handleExitFullscreen,
		updateAttachments,
		downloadPolicy,
	})

	// 注入 Manager 依赖（getCanvasElements、methods、pubsub 等）
	useEffect(() => {
		markerManager.updateDependencies({
			getCanvasElements: (id) =>
				id === designProjectId ? { elements: designData.canvas?.elements } : null,
			getElementImageInfo: (elementId: string) => {
				// 尝试从画布获取图片信息（画布打开时优先使用）
				return (
					canvasDesignRef.current?.getElementImageInfo(elementId) ?? Promise.resolve(null)
				)
			},
			getFileInfo: methods.getFileInfo,
			uploadPrivateFiles: methods.uploadPrivateFiles,
			identifyImageMark: methods.identifyImageMark,
			publishToMessageEditor: (event, payload) => pubsub.publish(event, payload),
			projectId,
			topicId: selectedTopic?.id,
			getImageOssUrl: (elementId: string) =>
				canvasDesignRef.current?.getImageOssUrl(elementId) ?? Promise.resolve(null),
		})
	}, [
		markerManager,
		designProjectId,
		designData.canvas?.elements,
		methods.getFileInfo,
		methods.uploadPrivateFiles,
		methods.identifyImageMark,
		projectId,
		selectedTopic?.id,
	])

	// 使用 hook 处理 marker 相关逻辑
	const { handleMarkerCreated, handleMarkerDeleted, handleMarkerUpdated, handleMarkerRestored } =
		useDesignMarker({
			canvas: designData.canvas,
			methods,
			projectId,
			designProjectId,
			markerManager,
			topicId: selectedTopic?.id,
			displayName, // marker 显示仍需要名称
			canvasDesignRef,
			selectedProject,
			selectedWorkspace,
			t,
		})

	// 事件处理
	useDesignFocusElement({
		designProjectId,
		isInitialLoading,
		canvasDesignRef,
		isPlaybackMode,
	})

	// 重新初始化页面（用于刷新按钮）
	const handleReinitialize = useCallback(async () => {
		// 先更新 markersForCanvas
		setMarkersForCanvas(markerManager.getMarkers(designProjectId ?? ""))
		await resetAndReload()
		if (magicProjectJsFileId && fetchFileVersions && !isShareRoute) {
			await fetchFileVersions()
		}
	}, [
		resetAndReload,
		magicProjectJsFileId,
		fetchFileVersions,
		isShareRoute,
		markerManager,
		designProjectId,
	])

	// 获取 CommonHeaderV2 的 props（定位到文件时定位到 magic.project.js）
	const headerProps = useDesignHeaderProps({
		locateFileId: magicProjectJsFileId ?? undefined,
		currentFile,
		projectId,
		selectedProject,
		attachments,
		fileVersion,
		isNewestVersion,
		fileVersionsList,
		allowEdit,
		allowDownload,
		containerRef,
		handleReinitialize,
		handleChangeFileVersion,
		handleReturnLatest,
		handleVersionRollback,
	})

	// 获取是否是移动端
	const getIsMobile = useCallback(() => {
		return isMobile
	}, [isMobile])

	const persistCanvasData = useCallback(
		(canvasData: CanvasDocument) => {
			updateDesignDataAndScheduleSave((draft) => {
				draft.canvas = canvasData
			})
		},
		[updateDesignDataAndScheduleSave],
	)

	const { handleCanvasDesignDataChange: syncCanvasImageFileRename } =
		useCanvasImageFileRenameSync({
			canvasDesignRef,
			currentCanvasData: designData.canvas,
			flatAttachments,
			attachmentIndex,
			designProjectBasePath,
			projectId,
			persistCanvasData,
			updateAttachments,
		})

	// 处理画布数据变化（用户编辑，触发自动保存）
	const handleCanvasDesignDataChange = useCallback(
		(canvasData: CanvasDocument) => {
			if (isApplyingRemoteCanvasUpdateRef.current) return

			persistCanvasData(canvasData)
			syncCanvasImageFileRename(canvasData)
		},
		[persistCanvasData, syncCanvasImageFileRename],
	)

	useCanvasResourceRefresh({
		canvasDesignRef,
		canvas: designData.canvas,
		flatAttachments,
		attachmentIndex,
		designProjectBasePath,
		projectId,
		isNewestVersion,
		isPlaybackMode,
	})

	// 处理名称变化（用户编辑，触发自动保存）
	// 注意：迁移到 CommonHeaderV2 后，头部不再有名称编辑器，此函数保留用于其他可能的用途
	// const handleNameChange = useCallback(
	// 	(name: string) => {
	// 		updateDesignDataAndScheduleSave((draft) => {
	// 			draft.name = name
	// 		})
	// 	},
	// 	[updateDesignDataAndScheduleSave],
	// )

	// 适配 CanvasDesign 的 TFunction 类型
	// 从 canvasDesign 命名空间加载翻译
	const canvasDesignTAdapter = useCallback(
		(key: string, options?: string | Record<string, unknown>) => {
			let result: string | object
			// 从 canvasDesign 命名空间加载翻译
			if (typeof options === "string") {
				result = canvasDesignT(key, { defaultValue: options, ns: "canvasDesign" })
			} else if (options && typeof options === "object") {
				// 如果 options 中有 defaultValue，使用它；否则使用 canvasDesign 命名空间的翻译
				const defaultValue = "defaultValue" in options ? options.defaultValue : undefined
				result = canvasDesignT(key, {
					...options,
					defaultValue: defaultValue || key,
					ns: "canvasDesign",
				})
			} else {
				result = canvasDesignT(key, { defaultValue: key, ns: "canvasDesign" })
			}
			// 确保返回值始终是字符串
			return typeof result === "string" ? result : String(result)
		},
		[canvasDesignT],
	)

	// 组件挂载时加载初始数据
	// 监听 attachments 变化，确保在 attachments 有数据后再加载
	// 这样可以避免在 attachments 未加载完成时就尝试查找文件，导致找不到文件但 isInitialLoading 被设置为 false
	// 只加载一次，文件切换时不重新加载（保持与 useMount 的行为一致）
	useEffect(() => {
		// 如果已经加载过，不再重复加载
		if (hasLoadedRef.current) {
			return
		}

		// 如果 attachments 为空，不执行加载，等待 attachments 更新
		if (!attachments || attachments.length === 0) {
			return
		}

		// attachments 有数据后，执行加载
		hasLoadedRef.current = true

		loadFromRemote().then(() => {
			if (isMobile) {
				setTimeout(() => {
					canvasDesignRef.current?.fitToScreen()
				}, 1)
			}
			if (isPlaybackMode) {
				setTimeout(() => {
					if (propsElements) {
						canvasDesignRef.current?.focusElement(
							propsElements.map((element) => element.id),
							{
								animated: false,
								selectElement: false,
							},
						)
					} else {
						canvasDesignRef.current?.fitToScreen()
					}
				}, 100)
			}
		})
	}, [attachments, isMobile, isPlaybackMode, loadFromRemote, propsElements])

	// 监听 allowEdit、isPlaybackMode、isShareRoute 和 isMobile 变化，更新只读状态
	// 如果当前不在查看历史版本，则根据 allowEdit、isPlaybackMode、isShareRoute 或 isMobile 更新只读状态
	// 如果正在查看历史版本，则保持只读状态不变（由 onVersionChange 处理）
	useEffect(() => {
		if (isNewestVersion) {
			setIsReadOnlyState(!allowEdit || isPlaybackMode || isShareRoute || isMobile)
		}
	}, [allowEdit, isMobile, isNewestVersion, isPlaybackMode, isShareRoute, setIsReadOnlyState])

	// 显示历史版本 banner 时预留顶部空间，避免遮挡画布（与 HISTORY_VERSION_BANNER_LAYOUT_HEIGHT_PX 一致）
	const showVersionBanner = !isNewestVersion && !isMobile && !!fileVersionsList?.length

	return (
		<>
			<div
				ref={containerRef}
				className={styles.designViewerContainer}
				style={
					showVersionBanner
						? { paddingTop: HISTORY_VERSION_BANNER_LAYOUT_HEIGHT_PX }
						: undefined
				}
			>
				{isInitialLoading ? (
					<FlexBox justify="center" align="center" style={{ height: "100%" }}>
						<MagicSpin spinning />
					</FlexBox>
				) : (
					<>
						{showFileHeader && (
							<>
								{/* 旧组件已注释，使用 CommonHeaderV2 替代 */}
								{/* <CanvasDesignHeader
									designData={designData}
									name={displayName}
									onNameChange={handleNameChange}
									isSaving={isSaving}
									attachments={attachments}
									currentFile={currentFile}
									containerRef={containerRef}
									onReinitialize={handleReinitialize}
									// 版本控制相关
									fileVersionsList={fileVersionsList}
									fileVersion={fileVersion}
									isNewestVersion={isNewestVersion}
									onChangeFileVersion={handleChangeFileVersion}
									onReturnLatest={handleReturnLatest}
									onVersionRollback={handleVersionRollback}
									isReadOnly={isReadOnlyState}
									isMobile={isMobile}
									allowEdit={allowEdit}
									updateAttachments={updateAttachments}
									allowDownload={allowDownload}
								/> */}
								<CanvasDesignHeaderV2 {...headerProps} />
							</>
						)}
						<div className={styles.designCanvasContainer}>
							<CanvasDesign
								key={`${designProjectId}:${canvasDesignKey}`}
								id={designProjectId}
								ref={canvasDesignRef}
								readonly={isReadOnlyState}
								magic={{
									methods,
									permissions: designCanvasMagicPermissions,
									hostUiLocale,
								}}
								viewport={{
									autoLoadCacheViewport: !isPlaybackMode && !isMobile,
								}}
								data={{
									defaultData: designData.canvas,
									onCanvasDesignDataChange: handleCanvasDesignDataChange,
									projectAttachmentMentionTree,
									defaultProjectAttachmentFolderId,
									defaultProjectAttachmentFolderName,
									mentionDataServiceCtor: CanvasDesignMentionDataService,
									mentionExtension: MentionExtension,
									referenceResourcePanelRenderer:
										CanvasDesignReferenceResourcePanel,
								}}
								marker={{
									defaultMarkers: markersForCanvas,
									onMarkerCreated: handleMarkerCreated,
									onMarkerDeleted: handleMarkerDeleted,
									onMarkerUpdated: handleMarkerUpdated,
									onMarkerRestored: handleMarkerRestored,
								}}
								t={canvasDesignTAdapter}
								getIsMobile={getIsMobile}
								shareHostBottomChrome={isShareRoute}
							/>
							{/* 撤回/恢复遮罩层 */}
							{isProcessingRevoke && (
								<div className={styles.revokeOverlay}>
									<div className={styles.revokeOverlayContent}>
										<MagicSpin spinning size="large" />
										<div>
											{revokeType === "restore"
												? t("warningCard.processingRestore")
												: t("warningCard.processingRevoke")}
										</div>
									</div>
								</div>
							)}
						</div>
					</>
				)}
			</div>
			{/* 下载无水印图片协议弹窗 */}
			{(waterMarkFreeModalInitialized || waterMarkFreeModalVisible) && (
				<Suspense fallback={null}>
					<WaterMarkFreeModal
						visible={waterMarkFreeModalVisible}
						onClose={() => {
							setWaterMarkFreeModalVisible(false)
							setDownloadFileElements([])
						}}
						onConfirm={async () => {
							if (downloadFileElements.length > 0 && executeDownload) {
								// 用户已同意协议，直接执行下载（跳过协议检查）
								try {
									await downloadPolicy.handleAgreementConfirm(() =>
										executeDownload(downloadFileElements, true),
									)
								} catch (error) {
									//
								}
							}
						}}
					/>
				</Suspense>
			)}
		</>
	)
}

export default observer(DesignViewer)
