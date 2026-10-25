import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { platformKey } from "@/utils/storage"
import SuperMagicService from "@/pages/superMagic/services"
import { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { workspaceStore } from "@/pages/superMagic/stores/core"
import type {
	CreatedProject,
	ProjectListItem,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"

export function isTaskWorkspace(workspace: Workspace | null): workspace is Workspace {
	return Boolean(workspace && workspace.workspace_type === "default" && !workspace.is_archived)
}

/** Task destinations never share the chat workspace cache or the detail page's selection. */
export function useTaskHomeContext(
	accountKey: string,
	entryWorkspaceId: string | null,
	enabled = true,
) {
	const { t } = useTranslation("super/mainInput")
	const [topicStore] = useState(() => new TopicStore())
	const [selectedProject, setSelectedProject] = useState<ProjectListItem | null>(null)
	const [workspace, setWorkspace] = useState<Workspace | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(false)
	const createdRef = useRef<CreatedProject | null>(null)
	const workdirRef = useRef<string>()
	const revisionRef = useRef(0)
	const mountedRef = useRef(true)
	const cacheKey = platformKey(`mobile-task-workspace:${accountKey}`)

	useEffect(() => {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
			revisionRef.current += 1
		}
	}, [])

	const selectWorkspace = useMemoizedFn((next: Workspace) => {
		// Changing the destination after a failed send must not reuse the old created project.
		if (workspace?.id !== next.id) {
			// A successfully created project already owns this directory; later sends copy mentions.
			if (createdRef.current) workdirRef.current = undefined
			createdRef.current = null
			setSelectedProject(null)
			topicStore.setSelectedTopic(null)
		}
		revisionRef.current += 1
		setWorkspace(next)
		setError(false)
		setLoading(false)
		try {
			localStorage.setItem(cacheKey, next.id)
		} catch {
			/* Storage may be disabled. */
		}
	})

	const initialize = useMemoizedFn(async () => {
		const revision = ++revisionRef.current
		setLoading(true)
		setError(false)
		try {
			let remembered: string | null = null
			try {
				remembered = localStorage.getItem(cacheKey)
			} catch {
				/* Storage may be disabled. */
			}
			const preferredId = entryWorkspaceId || remembered
			let next = preferredId
				? await SuperMagicService.workspace
						.getWorkspaceDetail(preferredId)
						.catch(() => null)
				: null
			// An explicit destination must be resolved by the user if it is no longer accessible.
			if (!isTaskWorkspace(next) && entryWorkspaceId) throw new Error("workspace_unavailable")
			let page = 1
			while (!isTaskWorkspace(next)) {
				const response = await SuperMagicApi.getWorkspaces({
					page,
					page_size: 50,
					workspace_type: "default",
					auto_create: false,
				})
				if (revision !== revisionRef.current || !mountedRef.current) return
				next = response.list.find(isTaskWorkspace) ?? null
				if (page * 50 >= response.total || !response.list.length) break
				page += 1
			}
			if (revision !== revisionRef.current || !mountedRef.current) return
			if (next) selectWorkspace(next)
			else setWorkspace(null)
		} catch {
			if (revision !== revisionRef.current || !mountedRef.current) return
			setWorkspace(null)
			setError(true)
		} finally {
			if (mountedRef.current && revision === revisionRef.current) setLoading(false)
		}
	})

	useEffect(() => {
		// Merely opening chat must not resolve or replace the remembered task destination.
		if (enabled) void initialize()
	}, [enabled, entryWorkspaceId, initialize])

	const validateWorkspace = useMemoizedFn(async () => {
		if (!workspace || loading) {
			magicToast.error(t("mobileHome.chooseWorkspace"))
			return false
		}
		const id = workspace.id
		const revision = revisionRef.current
		try {
			const current = await SuperMagicService.workspace.getWorkspaceDetail(id)
			if (!mountedRef.current || revision !== revisionRef.current) return false
			if (!isTaskWorkspace(current) || current.id !== id)
				throw new Error("workspace_unavailable")
			setWorkspace(current)
			return true
		} catch {
			if (mountedRef.current) magicToast.error(t("mobileHome.workspaceUnavailable"))
			return false
		}
	})

	const createProject = useMemoizedFn<NonNullable<SceneEditorContext["createProject"]>>(
		async (params) => {
			if (createdRef.current) return createdRef.current
			if (!workspace) return null
			const revision = revisionRef.current
			workdirRef.current = params.workdir ?? workdirRef.current
			const created = await SuperMagicService.project.createProject({
				workspaceId: workspace.id,
				...params,
				workdir: workdirRef.current,
			})
			if (!mountedRef.current || revision !== revisionRef.current) return null
			createdRef.current = created
			return created
		},
	)

	const context: Partial<SceneEditorContext> = {
		selectedProject,
		selectedTopic: topicStore.selectedTopic,
		selectedWorkspace: workspace,
		setSelectedProject,
		setSelectedTopic: topicStore.setSelectedTopic,
		topicStore,
		createProject,
		beforeSend: validateWorkspace,
		onSendSuccess: ({ currentProject, currentTopic }) => {
			if (!mountedRef.current || !currentProject || !currentTopic) return
			// switchProjectInMobile can navigate straight to the new topic only when the
			// destination workspace is already available in the global route context.
			if (workspace) workspaceStore.setSelectedWorkspace(workspace)
			void SuperMagicService.switchProjectInMobile(currentProject, currentTopic.id)
		},
		// Destination changes preserve the same task draft; chat has a separate draft scope.
		draftKey: {
			workspaceId: "mobile-task-home",
			projectId: "defaultProjectId",
			topicId: "defaultTopicId",
		},
		deferProjectCreationUntilSend: true,
		allowRecordingMode: false,
	}
	return { context, workspace, loading, error, selectWorkspace, retry: initialize }
}
