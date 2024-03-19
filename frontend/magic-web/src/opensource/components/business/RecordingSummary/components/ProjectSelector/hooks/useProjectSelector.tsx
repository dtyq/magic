import { useMemoizedFn } from "ahooks"
import { lazy, Suspense, useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ProjectListItem, Workspace } from "@/opensource/pages/superMagic/pages/Workspace/types"

const ProjectSelector = lazy(() => import(".."))

function useProjectSelector({
	initialProject,
	initialWorkspace,
	onProjectSelectConfirm,
}: {
	initialProject?: ProjectListItem | null
	initialWorkspace?: Workspace | null
	onProjectSelectConfirm?: (data: {
		workspace: Workspace | null
		project: ProjectListItem | null
	}) => void
}) {
	const { t } = useTranslation("super")
	const [projectSelectorOpen, setProjectSelectorOpen] = useState(false)

	const openSelector = useCallback(() => {
		setProjectSelectorOpen(true)
	}, [])

	const promise = useRef<{
		resolve:
			| ((value: { project: ProjectListItem | null; workspace: Workspace | null }) => void)
			| null
		reject: ((reason?: unknown) => void) | null
	}>({
		resolve: null,
		reject: null,
	})

	const openSelectorWithResult = useMemoizedFn(async () => {
		setProjectSelectorOpen(true)

		return new Promise<{
			project: ProjectListItem | null
			workspace: Workspace | null
		}>((resolve, reject) => {
			promise.current.resolve = (value: {
				project: ProjectListItem | null
				workspace: Workspace | null
			}) => {
				resolve(value)
			}
			promise.current.reject = reject
		})
	})

	const onCloseSelector = useMemoizedFn(() => {
		setProjectSelectorOpen(false)
		promise.current.reject?.("canceled")
	})

	const ProjectSelectorComponent = projectSelectorOpen && (
		<Suspense fallback={null}>
			<ProjectSelector
				open={projectSelectorOpen}
				onClose={onCloseSelector}
				initialProject={initialProject}
				initialWorkspace={initialWorkspace}
				onProjectConfirm={(project, workspace) => {
					promise.current.resolve?.({
						workspace,
						project,
					})

					onProjectSelectConfirm?.({
						workspace: workspace,
						project: project,
					})
					setProjectSelectorOpen(false)
				}}
				title={t("recordingSummary.projectSelector.selectStorageToProject")}
			/>
		</Suspense>
	)

	return {
		ProjectSelectorComponent,
		openSelector,
		openSelectorWithResult,
	}
}

export default useProjectSelector
