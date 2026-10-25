import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import {
	getFileAccessContentKey,
	isShareFileAccess,
} from "@/pages/superMagic/fileAccess/fileAccessContext"
import { useFileData } from "@/pages/superMagic/hooks/useFileData"
import { findMatchingFile, flattenAttachments } from "../utils"
import { downloadFileContent } from "@/pages/superMagic/utils/api"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { measureManualPerfOperation } from "@/utils/manualPerfLogger"

interface DashboardVersioningState {
	fileVersion?: number
	changeFileVersion: (fileVersion: number | undefined) => void
	fileVersionsList: any[]
	handleVersionRollback: (fileVersion?: number) => void
	isNewestVersion: boolean
	loading: boolean
}

interface DashboardActiveHistory extends DashboardVersioningState {
	previewRevision: number
	isPreviewReady: boolean
}

interface UseDashboardVersioningParams {
	attachmentList?: any[]
	displayData?: any
	displayConfig?: any
	isFromNode?: boolean
	isPlaybackMode?: boolean
	isSharePreview?: boolean
	htmlVersioning: DashboardVersioningState
}

function flattenAttachmentTree(items: any[] = []): any[] {
	const flattenedItems: any[] = []
	const stack = [...items].reverse()

	while (stack.length > 0) {
		const item = stack.pop()
		if (!item) continue

		flattenedItems.push(item)
		if (item.children?.length) {
			for (let index = item.children.length - 1; index >= 0; index -= 1) {
				stack.push(item.children[index])
			}
		}
	}

	return flattenedItems
}

export function useDashboardVersioning({
	attachmentList,
	displayData,
	displayConfig,
	isFromNode,
	isPlaybackMode,
	isSharePreview = false,
	htmlVersioning,
}: UseDashboardVersioningParams) {
	const fileAccess = useFileAccess()
	const fileApi = useFileApi()
	// Omit share token so token refresh does not remount the dashboard preview.
	const fileAccessContentKey = getFileAccessContentKey(fileAccess)
	const flattenedAttachmentList = useMemo(
		() =>
			measureManualPerfOperation(
				"html_dashboard_flatten_files_ms",
				() => (attachmentList ? flattenAttachments(attachmentList) : []),
				(result) => ({ file_count: result.length }),
			),
		[attachmentList],
	)
	const allAttachmentItems = useMemo(
		() =>
			measureManualPerfOperation(
				"html_dashboard_flatten_tree_ms",
				() => flattenAttachmentTree(attachmentList),
				(result) => ({ item_count: result.length }),
			),
		[attachmentList],
	)

	const filesById = useMemo(() => {
		return new Map(allAttachmentItems.map((item: any) => [item.file_id, item] as const))
	}, [allAttachmentItems])

	const currentFile = displayData?.file_id ? filesById.get(displayData.file_id) : undefined
	const parentFile = currentFile?.parent_id ? filesById.get(currentFile.parent_id) : undefined
	const isDataAnalysis =
		parentFile?.display_config?.type === "dashboard" || displayConfig?.type === "dashboard"

	const dashboardDataJsFile = useMemo(() => {
		if (!isDataAnalysis || !currentFile?.relative_file_path || !currentFile?.file_name) {
			return null
		}

		const htmlRelativeFolderPath = currentFile.relative_file_path.replace(
			currentFile.file_name,
			"",
		)

		return (
			findMatchingFile({
				path: "./data.js",
				allFiles: flattenedAttachmentList,
				htmlRelativeFolderPath,
			}) ||
			findMatchingFile({
				path: "data.js",
				allFiles: flattenedAttachmentList,
				htmlRelativeFolderPath,
			}) ||
			flattenedAttachmentList.find(
				(item: any) => item.relative_file_path === `${htmlRelativeFolderPath}data.js`,
			) ||
			null
		)
	}, [currentFile, flattenedAttachmentList, isDataAnalysis])

	const {
		fileVersionsList: dashboardDataJsFileVersionsList,
		handleVersionRollback: handleDashboardDataJsVersionRollback,
		fetchFileVersions: fetchDashboardDataJsFileVersions,
	} = useFileData({
		file_id: dashboardDataJsFile?.file_id || "",
		activeFileId: dashboardDataJsFile?.file_id || null,
		isFromNode,
		content: "",
		disabledUrlCache: isPlaybackMode,
		isSharePreview,
	})

	const isDashboardHistoryDriven = Boolean(isDataAnalysis && dashboardDataJsFile?.file_id)
	const [selectedDashboardVersion, setSelectedDashboardVersion] = useState<number | undefined>(
		undefined,
	)
	const [dashboardDataJsContent, setDashboardDataJsContent] = useState<string>()
	const [isDashboardContentLoading, setIsDashboardContentLoading] = useState(false)
	const [previewRevision, setPreviewRevision] = useState(0)
	const requestIdRef = useRef(0)
	const hasLoadedDashboardContentRef = useRef(false)
	const dashboardContentRef = useRef<string | undefined>(undefined)
	dashboardContentRef.current = dashboardDataJsContent

	useEffect(() => {
		setSelectedDashboardVersion(undefined)
		setDashboardDataJsContent(undefined)
		setIsDashboardContentLoading(false)
		setPreviewRevision(0)
		requestIdRef.current = 0
		hasLoadedDashboardContentRef.current = false
	}, [dashboardDataJsFile?.file_id])

	useEffect(() => {
		if (!isDashboardHistoryDriven || !dashboardDataJsFile?.file_id) return
		if (isSharePreview && !isShareFileAccess(fileAccess)) return

		const currentRequestId = requestIdRef.current + 1
		requestIdRef.current = currentRequestId
		// Soft refresh on share-token rotation: keep the preview mounted.
		const keepExistingPreview = hasLoadedDashboardContentRef.current
		if (!keepExistingPreview) {
			setIsDashboardContentLoading(true)
		}

		fileApi
			.getTemporaryDownloadUrl({
				file_ids: [dashboardDataJsFile.file_id],
				file_versions: selectedDashboardVersion
					? { [dashboardDataJsFile.file_id]: selectedDashboardVersion }
					: undefined,
			})
			.then(async (response) => {
				if (requestIdRef.current !== currentRequestId) return

				const url = response?.[0]?.url
				if (!url) {
					setDashboardDataJsContent(undefined)
					hasLoadedDashboardContentRef.current = false
					return
				}

				const content = await downloadFileContent(url)
				if (requestIdRef.current !== currentRequestId) return

				const nextContent = typeof content === "string" ? content : undefined
				const contentChanged = dashboardContentRef.current !== nextContent
				setDashboardDataJsContent(nextContent)
				if (typeof nextContent === "string") {
					hasLoadedDashboardContentRef.current = true
				}
				// Remount only when data.js content actually changes.
				if (!keepExistingPreview || contentChanged) {
					setPreviewRevision((prev) => prev + 1)
				}
			})
			.catch((error) => {
				if (requestIdRef.current !== currentRequestId) return
				console.error("Failed to load dashboard data.js version:", error)
				setDashboardDataJsContent(undefined)
				hasLoadedDashboardContentRef.current = false
			})
			.finally(() => {
				if (requestIdRef.current !== currentRequestId) return
				setIsDashboardContentLoading(false)
			})
	}, [
		dashboardDataJsFile?.file_id,
		dashboardDataJsFile?.updated_at,
		fileApi,
		fileAccessContentKey,
		isDashboardHistoryDriven,
		isSharePreview,
		selectedDashboardVersion,
	])

	const handleDashboardChangeFileVersion = useCallback((fileVersion: number | undefined) => {
		setSelectedDashboardVersion(fileVersion)
	}, [])

	const handleDashboardVersionRollback = useCallback(
		async (fileVersion?: number) => {
			await handleDashboardDataJsVersionRollback(fileVersion)
			setSelectedDashboardVersion(undefined)
		},
		[handleDashboardDataJsVersionRollback],
	)

	const dashboardActiveHistory = useMemo<DashboardActiveHistory>(() => {
		const isNewestVersion =
			!selectedDashboardVersion ||
			selectedDashboardVersion === dashboardDataJsFileVersionsList[0]?.version

		return {
			fileVersion: selectedDashboardVersion,
			changeFileVersion: handleDashboardChangeFileVersion,
			fileVersionsList: dashboardDataJsFileVersionsList,
			handleVersionRollback: handleDashboardVersionRollback,
			isNewestVersion,
			loading: isDashboardContentLoading,
			previewRevision,
			isPreviewReady:
				!isDashboardContentLoading && typeof dashboardDataJsContent === "string",
		}
	}, [
		dashboardDataJsContent,
		dashboardDataJsFileVersionsList,
		handleDashboardChangeFileVersion,
		handleDashboardVersionRollback,
		isDashboardContentLoading,
		previewRevision,
		selectedDashboardVersion,
	])

	const activeHistory = useMemo(() => {
		if (!isDashboardHistoryDriven) {
			return {
				...htmlVersioning,
				previewRevision: 0,
				isPreviewReady: true,
			} satisfies DashboardActiveHistory
		}

		return dashboardActiveHistory
	}, [dashboardActiveHistory, htmlVersioning, isDashboardHistoryDriven])

	const resourceFileVersions = useMemo(() => {
		if (!isDashboardHistoryDriven) return undefined
		if (!dashboardDataJsFile?.file_id || !selectedDashboardVersion) return undefined
		return {
			[dashboardDataJsFile.file_id]: selectedDashboardVersion,
		}
	}, [dashboardDataJsFile?.file_id, isDashboardHistoryDriven, selectedDashboardVersion])

	return {
		allAttachmentItems,
		flattenedAttachmentList,
		isDataAnalysis,
		dashboardDataJsFile,
		dashboardDataJsContent,
		activeHistory,
		resourceFileVersions,
		fetchDashboardDataJsFileVersions,
	}
}
