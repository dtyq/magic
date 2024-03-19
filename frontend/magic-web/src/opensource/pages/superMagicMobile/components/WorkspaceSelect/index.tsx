import type { Ref } from "react"
import {
	forwardRef,
	lazy,
	memo,
	Suspense,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import {
	isCollaborationProject,
	isCollaborationWorkspace,
} from "@/opensource/pages/superMagic/constants"
import CollaborationProjectTag from "@/opensource/pages/superMagic/components/CollaborationProjectTag"
import { workspaceStore, projectStore } from "@/opensource/pages/superMagic/stores/core"
import { HierarchicalWorkspacePopupRef } from "../HierarchicalWorkspacePopup/types"
import { useMount } from "ahooks"
import { ChevronsUpDown } from "lucide-react"
import { cn } from "@/opensource/lib/utils"
import { useParams } from "react-router"
import ProjectIcon from "../HierarchicalWorkspacePopup/components/ProjectIcon"
import WorkspaceIcon from "../HierarchicalWorkspacePopup/components/WorkspaceIcon"

const HierarchicalWorkspacePopup = lazy(() => import("../HierarchicalWorkspacePopup"))

export interface WorkspaceSelectRef {
	close: () => void
}

interface WorkspaceSelectProps {
	setUserSelectDetail?: (detail: unknown) => void
}

function WorkspaceSelect(props: WorkspaceSelectProps, ref: Ref<WorkspaceSelectRef>) {
	const { projectId } = useParams()
	const onProjectPage = !!projectId
	const { setUserSelectDetail } = props
	const hierarchicalWorkspacePopupRef = useRef<HierarchicalWorkspacePopupRef>(null)
	const { t } = useTranslation("super")

	const [isInitializedHierarchicalWorkspacePopup, setIsInitializedHierarchicalWorkspacePopup] =
		useState(false)

	useMount(() => {
		requestIdleCallback(() => {
			setIsInitializedHierarchicalWorkspacePopup(true)
		})
	})

	// Get data from stores
	const selectedWorkspace = workspaceStore.selectedWorkspace ?? undefined
	const projects = projectStore.projects
	const selectedProject = projectStore.selectedProject ?? undefined

	const name = useMemo(() => {
		if (selectedProject) {
			return selectedProject?.project_name || t("project.unnamedProject")
		} else if (selectedWorkspace) {
			if (isCollaborationWorkspace(selectedWorkspace)) {
				return t("workspace.shareWorkspaceName")
			}
			return selectedWorkspace?.name || t("workspace.unnamedWorkspace")
		} else {
			return ""
		}
	}, [selectedWorkspace, selectedProject, t])

	useImperativeHandle(ref, () => {
		return {
			close: () => {
				hierarchicalWorkspacePopupRef.current?.close()
			},
		}
	})

	return (
		<>
			<div
				className={cn(
					"flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-1",
					"cursor-pointer overflow-hidden transition-colors active:bg-muted",
				)}
				onClick={() => hierarchicalWorkspacePopupRef.current?.show()}
			>
				<div className="flex-shrink-0">
					{onProjectPage ? <ProjectIcon /> : <WorkspaceIcon />}
				</div>
				<div className="flex min-w-0 flex-1 items-center gap-1">
					{selectedProject && (
						<CollaborationProjectTag
							visible={isCollaborationProject(selectedProject)}
							project={selectedProject}
							showText={false}
						/>
					)}
					<div className="truncate text-sm">{name}</div>
				</div>

				<ChevronsUpDown size={16} className="flex-shrink-0 text-sidebar-foreground" />
			</div>
			{isInitializedHierarchicalWorkspacePopup && (
				<Suspense fallback={null}>
					<HierarchicalWorkspacePopup
						ref={hierarchicalWorkspacePopupRef}
						setUserSelectDetail={setUserSelectDetail}
					/>
				</Suspense>
			)}
		</>
	)
}

export default memo(observer(forwardRef(WorkspaceSelect)))
