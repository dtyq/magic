import { observer } from "mobx-react-lite"
import { useEffect, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { Button } from "@/components/shadcn-ui/button"
import { KnowledgeApi } from "@/apis"
import { CrewKnowledge } from "@/types/crew-knowledge"
import magicToast from "@/components/base/MagicToaster/utils"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { ProjectSelectionStep } from "./DocumentCreate/document-types/project/steps/ProjectSelectionStep"
import { WikiSelectionStep } from "./DocumentCreate/document-types/wiki/steps/WikiSelectionStep"
import { ProjectDocumentStore } from "./DocumentCreate/store/project-document-store"
import { WikiDocumentStore } from "./DocumentCreate/store/wiki-document-store"
import { KnowledgeSubPageHeader } from "./KnowledgeSubPageHeader"
import { projectStore } from "@/pages/superMagic/stores/core"

export interface RebindModeViewProps {
	knowledgeCode: string
	knowledgeName?: string
	onComplete: () => void
	onCancel: () => void
}

/**
 * 重新绑定文件视图组件
 * 复用第一步的UI（ProjectSelectionStep 或 WikiSelectionStep），但没有步骤条
 * 布局与 DocumentCreateLayout 保持一致
 */
export const RebindModeView = observer(function RebindModeView({
	knowledgeCode,
	knowledgeName,
	onComplete,
	onCancel,
}: RebindModeViewProps) {
	const { t } = useTranslation("crew/create")
	const [knowledgeDetail, setKnowledgeDetail] = useState<CrewKnowledge.Detail | null>(null)
	const [loading, setLoading] = useState(true)
	const [loadError, setLoadError] = useState(false)
	const [saving, setSaving] = useState(false)

	// 根据知识库类型创建对应的store
	const store = useMemo(() => {
		if (!knowledgeDetail) return null

		if (knowledgeDetail.source_type === CrewKnowledge.KnowledgeSourceType.PROJECT_FILE) {
			return new ProjectDocumentStore()
		}
		if (
			knowledgeDetail.source_type === CrewKnowledge.KnowledgeSourceType.ENTERPRISE_KNOWLEDGE
		) {
			return new WikiDocumentStore()
		}
		return null
	}, [knowledgeDetail])

	// 从 source_bindings 回显已选择的数据
	useEffect(() => {
		if (!store || !knowledgeDetail?.source_bindings?.length) return

		console.log("RebindModeView - 开始回显数据:", {
			source_type: knowledgeDetail.source_type,
			source_bindings: knowledgeDetail.source_bindings,
		})

		if (knowledgeDetail.source_type === CrewKnowledge.KnowledgeSourceType.PROJECT_FILE) {
			const projectDocumentStore = store as ProjectDocumentStore

			// 设置工作区（从第一个 binding 读取）
			const firstBinding = knowledgeDetail.source_bindings[0]
			if (firstBinding.workspace_id) {
				console.log("RebindModeView - 设置工作区:", {
					workspace_id: firstBinding.workspace_id,
					workspace_type: firstBinding.workspace_type,
				})
				// 根据 workspace_type 判断是共享工作区还是普通工作区
				const workspaceId =
					firstBinding.workspace_type === "shared" ? "shared" : firstBinding.workspace_id
				// 回显模式：清空之前的项目，从后端数据重建
				projectDocumentStore.setSelectedWorkspace(workspaceId, undefined, true)

				// 如果是普通工作区，确保已加载项目列表
				if (workspaceId !== "shared") {
					console.log("RebindModeView - 检查是否需要加载工作区项目列表:", workspaceId)
					if (!projectStore.hasLoadedWorkspace(workspaceId)) {
						console.log("RebindModeView - 触发加载工作区项目列表:", workspaceId)
						// 主动触发加载项目列表
						void projectStore.loadProjectsForWorkspace(workspaceId)
					} else {
						console.log("RebindModeView - 工作区项目列表已加载:", workspaceId)
					}
				}
			}

			// 设置实时更新开关（所有项目共享）
			projectDocumentStore.setEnableRealtimeUpdates(
				firstBinding.sync_mode === CrewKnowledge.SyncMode.REALTIME,
			)

			// 遍历所有 bindings，添加所有项目
			knowledgeDetail.source_bindings.forEach((binding, index) => {
				if (binding.root_ref) {
					// 判断是否选中整个项目：targets 不存在或为空数组
					const isWholeProject = !binding.targets || binding.targets.length === 0
					console.log(`RebindModeView - 添加项目 ${index + 1}:`, {
						projectId: binding.root_ref,
						isWholeProject,
						targets: binding.targets,
					})
					projectDocumentStore.setSelectedProject(binding.root_ref, isWholeProject)

					// 设置选中的文件（需要传递 projectId）
					if (!isWholeProject && binding.targets && binding.targets.length > 0) {
						const fileIds = binding.targets.map((target) => target.target_ref)
						console.log(
							`RebindModeView - 设置项目 ${binding.root_ref} 的文件:`,
							fileIds,
						)
						// 传递 projectId 以更新正确的项目
						projectDocumentStore.setSelectedFiles(fileIds, binding.root_ref)
					}
				}
			})

			console.log("RebindModeView - 项目回显完成，当前 store 状态:", {
				selectedProjects: projectDocumentStore.selectedProjects,
			})
		} else if (
			knowledgeDetail.source_type === CrewKnowledge.KnowledgeSourceType.ENTERPRISE_KNOWLEDGE
		) {
			const wikiStore = store as WikiDocumentStore

			const firstBinding = knowledgeDetail.source_bindings[0]

			// 设置实时更新开关
			wikiStore.setEnableRealtimeUpdates(
				firstBinding.sync_mode === CrewKnowledge.SyncMode.REALTIME,
			)

			// 遍历所有 bindings，添加所有知识库
			knowledgeDetail.source_bindings.forEach((binding) => {
				if (binding.root_ref) {
					// 判断是否选中整个知识库：targets 不存在或为空数组
					const isWholeWiki = !binding.targets || binding.targets.length === 0
					wikiStore.setSelectedWiki(binding.root_ref, isWholeWiki)

					// 设置选中的文件（需要传递 wikiId）
					if (!isWholeWiki && binding.targets && binding.targets.length > 0) {
						const fileRefs = binding.targets.map((target) => target.target_ref)
						// 传递 wikiId 以更新正确的知识库
						wikiStore.setSelectedFiles(fileRefs, binding.root_ref)
					}
				}
			})
		}
	}, [store, knowledgeDetail])

	// 加载知识库详情
	useEffect(() => {
		async function loadKnowledgeDetail() {
			try {
				setLoading(true)
				setLoadError(false)
				const detail = await KnowledgeApi.getCrewKnowledgeDetail(knowledgeCode)
				setKnowledgeDetail(detail)
			} catch (error) {
				console.error("加载知识库详情失败:", error)
				magicToast.error(t("knowledgeBase.loadFailed"))
				setLoadError(true)
			} finally {
				setLoading(false)
			}
		}

		void loadKnowledgeDetail()
		// 只依赖 knowledgeCode，避免不必要的重新加载
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [knowledgeCode])

	// 保存重新绑定的配置
	const handleSave = useMemoizedFn(async () => {
		if (!store || !knowledgeDetail) return

		setSaving(true)
		try {
			let sourceBindings
			let fragmentConfig

			if (knowledgeDetail.source_type === CrewKnowledge.KnowledgeSourceType.PROJECT_FILE) {
				const projectStore = store as ProjectDocumentStore
				sourceBindings = projectStore.buildSourceBindings()
				fragmentConfig = knowledgeDetail.fragment_config
			} else if (
				knowledgeDetail.source_type ===
				CrewKnowledge.KnowledgeSourceType.ENTERPRISE_KNOWLEDGE
			) {
				const wikiStore = store as WikiDocumentStore
				sourceBindings = wikiStore.buildSourceBindings()
				fragmentConfig = knowledgeDetail.fragment_config
			}

			if (!sourceBindings) {
				return
			}

			// 调用修改知识库接口（不等待响应，立即返回）
			await KnowledgeApi.updateCrewKnowledge({
				code: knowledgeCode,
				source_type: knowledgeDetail.source_type,
				source_bindings: sourceBindings,
				fragment_config: fragmentConfig,
			})

			// 显示成功提示
			// magicToast.success(t("knowledgeBase.rebindSuccess"))

			// 发布事件，触发知识库列表 polling
			pubsub.publish(PubSubEvents.Trigger_Knowledge_List_Polling)

			// 发布事件，通知文档列表需要刷新和启动 polling
			pubsub.publish(PubSubEvents.Trigger_Document_List_Polling)

			onComplete()
		} catch (error) {
			console.error("重新绑定失败:", error)
			const errorMsg =
				error instanceof Error ? error.message : t("knowledgeBase.rebindFailed")
			magicToast.error(errorMsg)
		} finally {
			setSaving(false)
		}
	})

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-sm text-muted-foreground">{t("knowledgeBase.loading")}</div>
			</div>
		)
	}

	if (loadError) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<div className="text-sm text-destructive">{t("knowledgeBase.loadFailed")}</div>
				<Button onClick={onCancel} variant="outline">
					{t("card.cancel")}
				</Button>
			</div>
		)
	}

	if (!knowledgeDetail || !store) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<div className="text-sm text-destructive">{t("knowledgeBase.unsupportedType")}</div>
				<Button onClick={onCancel} variant="outline">
					{t("card.cancel")}
				</Button>
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col gap-8 bg-background">
			{/* 头部：使用 KnowledgeSubPageHeader，与 DocumentCreateHeader 结构一致 */}
			<KnowledgeSubPageHeader
				knowledgeName={knowledgeName || knowledgeDetail.name}
				title={t("knowledgeBase.rebindTitle", { name: "" }).replace(" - ", "")}
				onBack={onCancel}
				onClose={onCancel}
			/>

			{/* 主内容区域：复用第一步的选择组件 */}
			<div className="flex-1 overflow-y-auto">
				{knowledgeDetail.source_type === CrewKnowledge.KnowledgeSourceType.PROJECT_FILE && (
					<RebindProjectContent
						store={store as ProjectDocumentStore}
						onSave={handleSave}
						nextText={t("documentCreate.navigation.complete")}
						hideNextIcon={true}
						nextLoading={saving}
					/>
				)}
				{knowledgeDetail.source_type ===
					CrewKnowledge.KnowledgeSourceType.ENTERPRISE_KNOWLEDGE && (
					<RebindWikiContent
						store={store as WikiDocumentStore}
						onSave={handleSave}
						nextText={t("documentCreate.navigation.complete")}
						hideNextIcon={true}
						nextLoading={saving}
					/>
				)}
			</div>
		</div>
	)
})

/**
 * 项目文件重新绑定内容
 * 包含 ProjectSelectionStep 的内容
 */
const RebindProjectContent = observer(function RebindProjectContent({
	store,
	onSave,
	nextText,
	hideNextIcon,
	nextLoading,
}: {
	store: ProjectDocumentStore
	onSave: () => void
	nextText?: string
	hideNextIcon?: boolean
	nextLoading?: boolean
}) {
	return (
		<ProjectSelectionStep
			store={store}
			onNext={onSave}
			nextText={nextText}
			hideNextIcon={hideNextIcon}
			nextLoading={nextLoading}
		/>
	)
})

/**
 * 企业知识库重新绑定内容
 * 包含 WikiSelectionStep 的内容
 */
const RebindWikiContent = observer(function RebindWikiContent({
	store,
	onSave,
	nextText,
	hideNextIcon,
	nextLoading,
}: {
	store: WikiDocumentStore
	onSave: () => void
	nextText?: string
	hideNextIcon?: boolean
	nextLoading?: boolean
}) {
	return (
		<WikiSelectionStep
			store={store}
			onNext={onSave}
			nextText={nextText}
			hideNextIcon={hideNextIcon}
			nextLoading={nextLoading}
		/>
	)
})
