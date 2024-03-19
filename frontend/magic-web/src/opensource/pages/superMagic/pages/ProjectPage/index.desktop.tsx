import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { useDeepCompareEffect, useDebounceFn, useUpdateEffect, useMemoizedFn } from "ahooks"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Detail, { type DetailRef } from "../../components/Detail"
import TopicFilesButton from "../../components/TopicFilesButton"
import useStyles from "../Workspace/style"
import GlobalMentionPanelStore from "@/opensource/components/business/MentionPanel/store"
import projectFilesStore from "@/opensource/stores/projectFiles"
import ProjectSider from "../../components/ProjectSider"
import { useTranslation } from "react-i18next"
import { useDetailModeCache } from "../../hooks/useDetailModeCache"
import { useAttachmentsPolling } from "../../hooks/useAttachmentsPolling"
import { AttachmentDataProcessor } from "../../utils/attachmentDataProcessor"
import { isCollaborationWorkspace } from "../../constants"
import { useNoPermissionCollaborationProject } from "../../hooks/useNoPermissionCollaborationProject"
import { observer } from "mobx-react-lite"
import { SuperMagicApi } from "@/opensource/apis"
import { workspaceStore, projectStore, topicStore } from "../../stores/core"
import { Files } from "lucide-react"
import ProjectCardContainer from "../../components/ProjectCardContainer"
import TopicDesktopPanels from "../TopicPage/components/TopicDesktopPanels"
import { useTopicDesktopLayout } from "../TopicPage/hooks/useTopicDesktopLayout"
import { useTopicDesktopPanelMotion } from "../TopicPage/hooks/useTopicDesktopPanelMotion"

// 项目页组件
function ProjectPage() {
	// Get workspace and project state from stores
	const selectedWorkspace = workspaceStore.selectedWorkspace
	const selectedProject = projectStore.selectedProject
	const selectedTopic = topicStore.selectedTopic

	/** ======================== Hooks ======================== */
	const { styles } = useStyles()
	const { t } = useTranslation("super")
	const { handleNoPermissionCollaborationProject } = useNoPermissionCollaborationProject()

	/** ======================== Refs ======================== */
	const detailRef = useRef<DetailRef>(null)

	/** ======================== States ======================== */
	const [autoDetail, setAutoDetail] = useState<any>()
	const [userSelectDetail, setUserSelectDetail] = useState<any>()
	const [attachments, setAttachments] = useState<any[]>([])
	const [attachmentList, setAttachmentList] = useState<any[]>([])
	// 当前活跃的文件ID，用于同步文件列表和文件查看器的选中状态
	const [activeFileId, setActiveFileId] = useState<string | null>(null)

	// Get current topic status from historyItems (which has the latest status)
	const currentTopicStatus = selectedTopic?.task_status
	const isReadOnly = true
	const shouldShowDetailPanel = true
	const showProjectResizeHandle = true

	const {
		containerRef,
		containerWidthPx,
		projectSiderWidthPx,
		messagePanelWidthPx,
		collapsedMessagePanelWidthPx,
		isConversationPanelCollapsed,
		isDraggingProjectSider,
		isDraggingMessagePanel,
		startDragProjectSider,
		startDragMessagePanel,
		ensureExpandedWhenDetailVisible,
	} = useTopicDesktopLayout({ isReadOnly, allowProjectSiderResize: showProjectResizeHandle })

	// 使用详情模式缓存 hook
	useDetailModeCache({
		selectedProjectId: selectedProject?.id,
		autoDetail,
		userDetail: userSelectDetail,
		setAutoDetail,
		setUserDetail: setUserSelectDetail,
	})

	// 订阅 activeFileId 更新事件
	useEffect(() => {
		const handleActiveFileIdUpdate = (fileId: string | null) => {
			console.log("🟢 Received activeFileId update via PubSub:", fileId)
			setActiveFileId(fileId)
		}

		pubsub.subscribe(PubSubEvents.Update_Active_File_Id, handleActiveFileIdUpdate)

		return () => {
			pubsub.unsubscribe(PubSubEvents.Update_Active_File_Id, handleActiveFileIdUpdate)
		}
	}, [])

	// 当项目或话题发生变化时，清理状态
	useUpdateEffect(() => {
		setActiveFileId(null)
		setAutoDetail(null)
		setUserSelectDetail(null)
	}, [selectedProject?.id])

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Open_File_Tab, (data: { fileId: string; fileData: any }) => {
			// 使用setTimeout确保DOM更新后再打开tab
			setTimeout(() => {
				detailRef.current?.openFileTab?.({ file_id: data.fileId })
			}, 100)
		})
		pubsub.subscribe(PubSubEvents.Open_Playback_Tab, (toolData: any) => {
			// 打开playback tab，用户主动点击时应该强制激活
			setTimeout(() => {
				detailRef.current?.openPlaybackTab?.({ toolData, forceActivate: true })
			}, 100)
		})
		return () => {
			pubsub?.unsubscribe(PubSubEvents.Open_File_Tab)
			pubsub?.unsubscribe(PubSubEvents.Open_Playback_Tab)
		}
	}, [])

	useDeepCompareEffect(() => {
		setUserSelectDetail(null)
	}, [selectedTopic?.id, selectedTopic?.chat_topic_id])

	// 集成轮询hook
	useAttachmentsPolling({
		projectId: selectedProject?.id,
		onAttachmentsChange: useCallback(
			({ tree, list }: { tree: any[]; list: never[] }) => {
				// 统一处理 metadata，内部自闭环处理验证和返回逻辑
				const processedData = AttachmentDataProcessor.processAttachmentData({ tree, list })
				setAttachments(processedData.tree)
				setAttachmentList(processedData.list)
				projectFilesStore.setWorkspaceFileTree(processedData.tree)
			},
			[setAttachments, setAttachmentList],
		),
		onError: useMemoizedFn((error: any) => {
			if (isCollaborationWorkspace(selectedWorkspace)) {
				// 团队共享项目，如果权限不足，回到首页
				handleNoPermissionCollaborationProject(error)
				return
			}
		}),
	})

	const updateAttachments = useDebounceFn(
		(selectedProject: any, callback?: () => void) => {
			if (!selectedProject?.id) {
				setAttachments([])
				projectFilesStore.setWorkspaceFileTree([])
				return
			}
			try {
				pubsub.publish(PubSubEvents.Update_Attachments_Loading, true)
				SuperMagicApi.getAttachmentsByProjectId({
					projectId: selectedProject?.id,
					// @ts-ignore 使用window添加临时的token
					temporaryToken: window.temporary_token || "",
				})
					.then((res) => {
						// 统一处理 metadata，包括 index.html 文件的特殊逻辑，内部自闭环处理验证和返回逻辑
						const processedData = AttachmentDataProcessor.processAttachmentData(res)
						setAttachments(processedData.tree)
						setAttachmentList(processedData.list)
						projectFilesStore.setWorkspaceFileTree(processedData.tree)
						GlobalMentionPanelStore.finishLoadAttachmentsPromise(selectedProject?.id)
					})
					.finally(() => {
						pubsub.publish(PubSubEvents.Update_Attachments_Loading, false)
					})
			} catch (error) {
				console.error("Failed to fetch attachments:", error)
				setAttachments([])
				projectFilesStore.setWorkspaceFileTree([])
			} finally {
				callback?.()
			}
		},
		{
			wait: 500,
		},
	).run

	useDeepCompareEffect(() => {
		const projectId = selectedProject?.id
		if (selectedProject) {
			// 初始化加载附件的Promise
			GlobalMentionPanelStore.initLoadAttachments(selectedProject?.id)
			updateAttachments(selectedProject)
		}

		return () => {
			if (projectId) {
				GlobalMentionPanelStore.clearInitLoadAttachmentsPromise(projectId)
			}
		}
	}, [selectedProject])

	const disPlayDetail = useMemo(() => {
		return userSelectDetail || autoDetail
	}, [userSelectDetail, autoDetail])

	const {
		panelResizeTransition,
		messageTransform,
		messagePanelTransition,
		detailContentTransform,
		detailContentTransition,
		targetMessagePanelWidth,
		targetRightHandleWidth,
		targetDetailPanelWidth,
	} = useTopicDesktopPanelMotion({
		isReadOnly,
		shouldShowDetailPanel,
		showProjectResizeHandle,
		containerWidthPx,
		projectSiderWidthPx,
		messagePanelWidthPx,
		collapsedMessagePanelWidthPx,
		isConversationPanelCollapsed,
		isDraggingProjectSider,
		isDraggingMessagePanel,
		ensureExpandedWhenDetailVisible,
	})

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Update_Attachments, (callback: any) => {
			if (!selectedProject) return

			updateAttachments(selectedProject, callback)
		})
		return () => {
			pubsub?.unsubscribe(PubSubEvents.Update_Attachments)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedProject])

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Super_Magic_Update_Auto_Detail, (data: any) => {
			setAutoDetail(data)
		})
		return () => {
			pubsub?.unsubscribe(PubSubEvents.Super_Magic_Update_Auto_Detail)
		}
	}, [])

	const handleFileClick = useMemoizedFn((fileItem?: any) => {
		setUserSelectDetail(null)
		// use setTimeout to ensure the DOM is updated before opening tab
		setTimeout(() => {
			detailRef.current?.openFileTab?.(fileItem)
		}, 100)
	})

	return (
		<TopicDesktopPanels
			containerRef={containerRef}
			containerClassName={styles.container}
			detailPanelClassName={styles.detailPanel}
			isDetailPanelFullscreen={false}
			sidebar={
				<div className="flex h-full flex-col gap-2" data-testid="workspace-sidebar-wrapper">
					<ProjectCardContainer
						selectedProject={selectedProject}
						selectedWorkspace={selectedWorkspace}
					/>
					<ProjectSider
						items={[
							{
								key: "topicFiles",
								title: t("topicFiles.title"),
								icon: <Files size={16} />,
								content: (
									<TopicFilesButton
										attachments={attachments as any}
										setUserSelectDetail={(detail: any) => {
											console.log("到顶层了", detail)
											setUserSelectDetail(detail)
										}}
										onFileClick={handleFileClick}
										projectId={selectedProject?.id}
										activeFileId={activeFileId}
										selectedTopic={selectedTopic}
										onAttachmentsChange={setAttachments}
										selectedProject={selectedProject}
										selectedWorkspace={selectedWorkspace}
										allowEdit={false}
										isInProject
									/>
								),
							},
						]}
						className="flex-1 overflow-hidden rounded-lg border border-border bg-background"
					/>
				</div>
			}
			detailPanel={
				<Detail
					ref={detailRef}
					disPlayDetail={disPlayDetail}
					userSelectDetail={userSelectDetail}
					setUserSelectDetail={setUserSelectDetail}
					attachments={attachments}
					attachmentList={attachmentList}
					topicId={selectedTopic?.id}
					baseShareUrl={`${window.location.origin}/share`}
					currentTopicStatus={currentTopicStatus}
					messages={[]}
					autoDetail={autoDetail}
					allowEdit={false}
					selectedTopic={selectedTopic}
					selectedProject={selectedProject}
					activeFileId={activeFileId}
					onActiveFileChange={setActiveFileId}
					showFallbackWhenEmpty
				/>
			}
			messagePanel={null}
			isReadOnly={isReadOnly}
			showProjectResizeHandle={showProjectResizeHandle}
			shouldShowDetailPanel={shouldShowDetailPanel}
			isConversationPanelCollapsed={isConversationPanelCollapsed}
			isDraggingProjectSider={isDraggingProjectSider}
			isDraggingMessagePanel={isDraggingMessagePanel}
			projectSiderWidthPx={projectSiderWidthPx}
			targetDetailPanelWidth={targetDetailPanelWidth}
			targetRightHandleWidth={targetRightHandleWidth}
			targetMessagePanelWidth={targetMessagePanelWidth}
			panelResizeTransition={panelResizeTransition}
			detailContentTransform={detailContentTransform}
			detailContentTransition={detailContentTransition}
			messageTransform={messageTransform}
			messagePanelTransition={messagePanelTransition}
			onProjectResizeStart={startDragProjectSider}
			onMessageResizeStart={startDragMessagePanel}
		/>
	)
}

// 导出的工作区组件
export default observer(ProjectPage)
