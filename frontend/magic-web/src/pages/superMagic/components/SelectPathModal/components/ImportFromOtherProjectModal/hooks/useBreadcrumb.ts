import { useState, useRef, useMemo, useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import type { AttachmentItem } from "../../../../TopicFilesButton/hooks"
import type { BreadcrumbItem, ViewMode } from "../../../types"
import type { Workspace, ProjectListItem } from "../../../../../pages/Workspace/types"
import { getItemName, getItemId } from "../../../utils/attachmentUtils"
import { calculateBreadcrumbDisplayItems } from "../../../utils/breadcrumbUtils"
import { SHARE_WORKSPACE_ID } from "../../../../../constants"

interface UseBreadcrumbOptions {
	viewMode: ViewMode
	currentWorkspace: Workspace | null
	currentSourceProject: ProjectListItem | null
	path: AttachmentItem[]
	visible: boolean
	onWorkspaceClick?: () => void
	onProjectClick?: () => void
	onDirectoryClick?: (item: BreadcrumbItem) => void
}

export function useBreadcrumb(options: UseBreadcrumbOptions) {
	const {
		viewMode,
		currentWorkspace,
		currentSourceProject,
		path,
		visible,
		onWorkspaceClick,
		onProjectClick,
		onDirectoryClick,
	} = options
	const { t } = useTranslation("super")

	const breadcrumbRef = useRef<HTMLDivElement>(null)
	const [breadcrumbContainerWidth, setBreadcrumbContainerWidth] = useState(0)

	const breadcrumbItemsRaw = useMemo<BreadcrumbItem[]>(() => {
		const output: BreadcrumbItem[] = []

		output.push({
			name: t("selectPathModal.workspace"),
			id: "workspace-root",
			operation: "all",
		})

		if (currentWorkspace) {
			const workspaceName =
				currentWorkspace.id === SHARE_WORKSPACE_ID
					? t("workspace.shareWorkspaceName")
					: currentWorkspace.name || t("workspace.unnamedWorkspace")
			output.push({
				name: workspaceName,
				id: currentWorkspace.id,
				operation: "all",
				isWorkspace: true,
			})
		}

		if (currentSourceProject) {
			output.push({
				name: currentSourceProject.project_name || t("project.unnamedProject"),
				id: currentSourceProject.id,
				operation: "all",
				isProject: true,
			})
		}

		if (viewMode === "directory") {
			output.push(
				...path.map(
					(o) =>
						({
							name: getItemName(o),
							id: getItemId(o),
							operation: "all",
						}) as BreadcrumbItem,
				),
			)
		}

		return output
	}, [currentWorkspace, currentSourceProject, path, viewMode, t])

	const breadcrumbItems = useMemo(() => {
		return calculateBreadcrumbDisplayItems(breadcrumbItemsRaw, breadcrumbContainerWidth)
	}, [breadcrumbItemsRaw, breadcrumbContainerWidth])

	const onBreadcrumbClick = useMemoizedFn((item: BreadcrumbItem) => {
		if (item.id === "workspace-root") {
			onWorkspaceClick?.()
			return
		}

		if (item.isWorkspace) {
			onProjectClick?.()
			return
		}

		if (item.isProject) {
			onDirectoryClick?.(item)
			return
		}

		if (viewMode === "directory") {
			onDirectoryClick?.(item)
		}
	})

	useEffect(() => {
		if (!visible) {
			setBreadcrumbContainerWidth(0)
			return
		}

		let resizeObserver: ResizeObserver | null = null

		const timer = setTimeout(() => {
			if (!breadcrumbRef.current) return

			setBreadcrumbContainerWidth(breadcrumbRef.current.offsetWidth)

			resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					setBreadcrumbContainerWidth(entry.contentRect.width)
				}
			})

			resizeObserver.observe(breadcrumbRef.current)
		}, 100)

		return () => {
			clearTimeout(timer)
			if (resizeObserver) {
				resizeObserver.disconnect()
			}
		}
	}, [visible])

	return {
		breadcrumbRef,
		breadcrumbItems,
		onBreadcrumbClick,
	}
}
