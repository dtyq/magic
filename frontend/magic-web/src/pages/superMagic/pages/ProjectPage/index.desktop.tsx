import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { runInAction } from "mobx"
import { useDeepCompareEffect, useDebounceFn, useUpdateEffect, useMemoizedFn } from "ahooks"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Detail, { type DetailRef } from "../../components/Detail"
import TopicFilesButton from "../../components/TopicFilesButton"
import useStyles from "../Workspace/style"
import GlobalMentionPanelStore from "@/components/business/MentionPanel/builtin-store"
import projectFilesStore from "@/stores/projectFiles"
import ProjectSider from "../../components/ProjectSider"
import { useTranslation } from "react-i18next"
import { useDetailModeCache } from "../../hooks/useDetailModeCache"
import { useAttachmentsPolling } from "../../hooks/useAttachmentsPolling"
import { useProjectAttachmentsChangeRealtime } from "../../hooks/useProjectAttachmentsChangeRealtime"
import { AttachmentDataProcessor } from "../../utils/attachmentDataProcessor"
import {
	measureAttachmentFetch,
	recordAttachmentsStaleResponseDropped,
} from "../../utils/attachmentPerf"
import {
	normalizeUpdateAttachmentsPayload,
	releaseAttachmentsRefreshWaitersWithoutFetch,
	resolveAttachmentsRefreshWaitersForProject,
	type SuperMagicUpdateAttachmentsRequest,
	withAttachmentsRefreshWaitersResolved,
} from "@/pages/superMagic/services/attachmentsTopicSync"
import { isCollaborationWorkspace } from "../../constants"
import { useNoPermissionCollaborationProject } from "../../hooks/useNoPermissionCollaborationProject"
import { observer } from "mobx-react-lite"
import { workspaceStore, projectStore, topicStore } from "../../stores/core"
import { Files } from "lucide-react"
import ProjectCardContainer from "../../components/ProjectCardContainer"
import TopicDesktopPanels from "../TopicPage/components/TopicDesktopPanels"
import { loadProjectAttachments } from "../../services"
import { isAbortError, useLatestAbortableRequest } from "../../hooks/useLatestAbortableRequest"
import { useProjectFirstAttachmentRender } from "../../hooks/useProjectFirstAttachmentRender"
import { isAudioProjectMode } from "../AudioRecordings/utils/is-audio-project-mode"
import { HostConversationProvider } from "../../contexts/HostConversationContext"
import type {
	SuperMagicOpenFileTabPayload,
	SuperMagicOpenKnowledgeBaseTabPayload,
	SuperMagicOpenMicroAppTabPayload,
} from "../../events/openFileTab"
import type { SuperMagicOpenPlaybackTabPayload } from "../../events/openPlaybackTab"
import { useSlidesTemplateNavigation } from "../../hooks/useSlidesTemplateNavigation"

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
	const { shouldRenderProjectFirstRequest, resetProjectFirstRequestRender } =
		useProjectFirstAttachmentRender()
	const { startRequest: startAttachmentsRequest, cancelCurrent: cancelAttachmentsRequest } =
		useLatestAbortableRequest()

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
	const hideProjectCard = isAudioProjectMode(selectedProject?.project_mode)

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

	useSlidesTemplateNavigation({
		selectedProjectId: selectedProject?.id,
		attachments,
		openTemplateFile: (templateItem) => detailRef.current?.openFileTab?.(templateItem),
		setUserSelectDetail,
	})

	useEffect(() => {
		const handleOpenFileTab = (data: SuperMagicOpenFileTabPayload) => {
			// 使用setTimeout确保DOM更新后再打开tab
			setTimeout(() => {
				// 允许消息区直接传入临时 fileData，复用右侧详情区打开逻辑。
				detailRef.current?.openFileTab?.(data.fileData ?? { file_id: data.fileId })
			}, 100)
		}
		const handleOpenPlaybackTab = (toolData: SuperMagicOpenPlaybackTabPayload) => {
			// 打开playback tab，用户主动点击时应该强制激活
			setTimeout(() => {
				detailRef.current?.openPlaybackTab?.({ toolData, forceActivate: true })
			}, 100)
		}
		const handleOpenKnowledgeBaseTab = (data: SuperMagicOpenKnowledgeBaseTabPayload) => {
			setTimeout(() => {
				detailRef.current?.openKnowledgeBaseTab?.(data)
			}, 100)
		}
		const handleOpenMicroAppTab = (data: SuperMagicOpenMicroAppTabPayload) => {
			setTimeout(() => {
				detailRef.current?.openMicroAppTab?.(data)
			}, 100)
		}

		pubsub.subscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)
		pubsub.subscribe(PubSubEvents.Open_Playback_Tab, handleOpenPlaybackTab)
		pubsub.subscribe(PubSubEvents.Open_Knowledge_Base_Tab, handleOpenKnowledgeBaseTab)
		pubsub.subscribe(PubSubEvents.Open_Micro_App_Tab, handleOpenMicroAppTab)

		return () => {
			pubsub.unsubscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)
			pubsub.unsubscribe(PubSubEvents.Open_Playback_Tab, handleOpenPlaybackTab)
			pubsub.unsubscribe(PubSubEvents.Open_Knowledge_Base_Tab, handleOpenKnowledgeBaseTab)
			pubsub.unsubscribe(PubSubEvents.Open_Micro_App_Tab, handleOpenMicroAppTab)
		}
	}, [])

	useDeepCompareEffect(() => {
		setUserSelectDetail(null)
	}, [selectedTopic?.id, selectedTopic?.chat_topic_id])

	// 集成轮询hook
	useAttachmentsPolling({
		projectId: selectedProject?.id,
		autoStart: false,
		onAttachmentsChange: useCallback(
			({ tree, list }: { tree: any[]; list: any[] }) => {
				// 统一处理 metadata，内部自闭环处理验证和返回逻辑
				const processedData = AttachmentDataProcessor.processAttachmentData(
					{ tree, list },
					{ preserveList: true },
				)
				setAttachments(processedData.tree)
				setAttachmentList(processedData.list)
				projectFilesStore.setWorkspaceFileTree(processedData.tree, {
					list: processedData.list,
					source: "ProjectPage.polling",
				})
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

	useProjectAttachmentsChangeRealtime({
		projectId: selectedProject?.id,
		onAttachmentsChange: useCallback(({ tree, list }) => {
			setAttachments(tree)
			setAttachmentList(list)
		}, []),
		onFallbackError: useMemoizedFn((error: unknown) => {
			if (isCollaborationWorkspace(selectedWorkspace)) {
				handleNoPermissionCollaborationProject(error)
				return
			}
			console.error("Failed to refresh realtime attachments:", error)
		}),
	})

	const updateAttachments = useDebounceFn(
		(selectedProject: any, callback?: () => void) => {
			const projectId = selectedProject?.id as string | undefined
			if (!projectId) {
				cancelAttachmentsRequest()
				resetProjectFirstRequestRender()
				setAttachments([])
				projectFilesStore.setWorkspaceFileTree([])
				releaseAttachmentsRefreshWaitersWithoutFetch()
				return
			}
			const request = startAttachmentsRequest()
			const shouldRenderIncrementally = shouldRenderProjectFirstRequest(projectId)
			let didCommitFinalSnapshot = false

			try {
				projectFilesStore.setAttachmentLoadStatus(projectId, "loading")
				pubsub.publish(PubSubEvents.Update_Attachments_Loading, true)
				withAttachmentsRefreshWaitersResolved(
					projectId,
					measureAttachmentFetch("ProjectPage.updateAttachments", () =>
						loadProjectAttachments({
							projectId,
							signal: request.signal,
							onBatchSnapshot: shouldRenderIncrementally
								? ({ tree, list, phase, isFinal }) => {
										if (!request.isCurrent()) {
											recordAttachmentsStaleResponseDropped(
												"ProjectPage.updateAttachments",
												{ stage: "batch_snapshot", phase },
											)
											return
										}
										const processedData =
											AttachmentDataProcessor.processAttachmentData(
												{ tree, list },
												{ preserveList: true },
											)
										runInAction(() => {
											setAttachments(processedData.tree)
											setAttachmentList(processedData.list)
											projectFilesStore.setWorkspaceFileTree(
												processedData.tree,
												{
													list: processedData.list,
													source: `ProjectPage.batch.${phase}`,
												},
											)
											if (isFinal) {
												didCommitFinalSnapshot = true
												projectFilesStore.setAttachmentLoadStatus(
													projectId,
													"ready",
												)
											}
										})
									}
								: undefined,
						}),
					)
						.then((res: Awaited<ReturnType<typeof loadProjectAttachments>>) => {
							if (!request.isCurrent()) {
								recordAttachmentsStaleResponseDropped(
									"ProjectPage.updateAttachments",
									{ stage: "load_result" },
								)
								return
							}
							runInAction(() => {
								if (!didCommitFinalSnapshot) {
									setAttachments(res.tree)
									setAttachmentList(res.list)
									projectFilesStore.setWorkspaceFileTree(res.tree, {
										list: res.list,
										source: "ProjectPage.load_result",
									})
								}
								projectFilesStore.setAttachmentLoadStatus(projectId, "ready")
							})
							GlobalMentionPanelStore.finishLoadAttachmentsPromise(projectId)
						})
						.catch((error: unknown) => {
							if (isAbortError(error)) return
							if (!request.isCurrent()) {
								recordAttachmentsStaleResponseDropped(
									"ProjectPage.updateAttachments",
									{ stage: "load_error" },
								)
								return
							}
							console.error("Failed to fetch attachments:", error)
							// 读取失败不能证明文件被删除，保留已交付快照供当前预览继续使用。
							projectFilesStore.setAttachmentLoadStatus(projectId, "error")
						})
						.finally(() => {
							request.release()
							if (request.isCurrent()) {
								pubsub.publish(PubSubEvents.Update_Attachments_Loading, false)
							}
							callback?.()
						}),
				)
			} catch (error) {
				if (isAbortError(error)) return
				if (!request.isCurrent()) return
				console.error("Failed to fetch attachments:", error)
				// 读取失败不能证明文件被删除，保留已交付快照供当前预览继续使用。
				projectFilesStore.setAttachmentLoadStatus(projectId, "error")
				resolveAttachmentsRefreshWaitersForProject(projectId)
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
			cancelAttachmentsRequest()
			if (projectId) {
				GlobalMentionPanelStore.clearInitLoadAttachmentsPromise(projectId)
			}
		}
	}, [selectedProject])

	const disPlayDetail = useMemo(() => {
		return userSelectDetail || autoDetail
	}, [userSelectDetail, autoDetail])

	useEffect(() => {
		const handleUpdateAttachments = (
			payloadOrCallback?: SuperMagicUpdateAttachmentsRequest,
		) => {
			const payload = normalizeUpdateAttachmentsPayload(payloadOrCallback)

			if (!selectedProject) {
				payload?.callback?.()
				releaseAttachmentsRefreshWaitersWithoutFetch()
				return
			}

			updateAttachments(selectedProject, payload?.callback)
		}

		pubsub.subscribe(PubSubEvents.Update_Attachments, handleUpdateAttachments)
		return () => {
			pubsub?.unsubscribe(PubSubEvents.Update_Attachments, handleUpdateAttachments)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedProject])

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Super_Magic_Update_Auto_Detail, (data) => {
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

	const renderMessagePanel = useMemoizedFn(() => null)

	return (
		<HostConversationProvider selectedProject={selectedProject} topicStore={topicStore}>
			<TopicDesktopPanels
				containerClassName={styles.container}
				detailPanelClassName={styles.detailPanel}
				isDetailPanelFullscreen={false}
				enableProjectCollapse={!hideProjectCard}
				sidebar={({ onCollapse, isCollapsed }) => (
					<div
						className="flex h-full flex-col gap-2"
						data-testid="workspace-sidebar-wrapper"
					>
						{hideProjectCard ? null : (
							<ProjectCardContainer
								onCollapse={onCollapse}
								isPanelVisible={!isCollapsed}
								selectedProject={selectedProject}
								selectedWorkspace={selectedWorkspace}
							/>
						)}
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
				)}
				detailPanel={(fileSidebarControl) => (
					<Detail
						fileSidebarControl={fileSidebarControl}
						attachmentLoadState={projectFilesStore.attachmentLoadState}
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
				)}
				isReadOnly={isReadOnly}
				showProjectResizeHandle={showProjectResizeHandle}
				shouldShowDetailPanel={shouldShowDetailPanel}
				renderMessagePanel={renderMessagePanel}
			/>
		</HostConversationProvider>
	)
}

// 导出的工作区组件
export default observer(ProjectPage)
