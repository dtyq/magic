import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useFileData } from "@/pages/superMagic/hooks/useFileData"
import { findMatchingFile, flattenAttachments } from "../utils"
import { downloadFileContent, getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"

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
	htmlVersioning: DashboardVersioningState
}

function flattenAttachmentTree(items: any[] = []): any[] {
	return items.reduce((acc: any[], item) => {
		const nextItems =
			item.is_directory && item.children ? flattenAttachmentTree(item.children) : []
		return [...acc, item, ...nextItems]
	}, [])
}

export function useDashboardVersioning({
	attachmentList,
	displayData,
	displayConfig,
	isFromNode,
	isPlaybackMode,
	htmlVersioning,
}: UseDashboardVersioningParams) {
	const flattenedAttachmentList = useMemo(
		() => (attachmentList ? flattenAttachments(attachmentList) : []),
		[attachmentList],
	)
	const allAttachmentItems = useMemo(
		() => flattenAttachmentTree(attachmentList),
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
	})

	const isDashboardHistoryDriven = Boolean(isDataAnalysis && dashboardDataJsFile?.file_id)
	const [selectedDashboardVersion, setSelectedDashboardVersion] = useState<number | undefined>(
		undefined,
	)
	const [dashboardDataJsContent, setDashboardDataJsContent] = useState<string>()
	const [isDashboardContentLoading, setIsDashboardContentLoading] = useState(false)
	const [previewRevision, setPreviewRevision] = useState(0)
	const requestIdRef = useRef(0)

	useEffect(() => {
		setSelectedDashboardVersion(undefined)
		setDashboardDataJsContent(undefined)
		setIsDashboardContentLoading(false)
		setPreviewRevision(0)
		requestIdRef.current = 0
	}, [dashboardDataJsFile?.file_id])

	useEffect(() => {
		if (!isDashboardHistoryDriven || !dashboardDataJsFile?.file_id) return

		const currentRequestId = requestIdRef.current + 1
		requestIdRef.current = currentRequestId
		setIsDashboardContentLoading(true)

		getTemporaryDownloadUrl({
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
					return
				}

				const content = await downloadFileContent(url)
				if (requestIdRef.current !== currentRequestId) return

				setDashboardDataJsContent(typeof content === "string" ? content : undefined)
				setPreviewRevision((prev) => prev + 1)
			})
			.catch((error) => {
				if (requestIdRef.current !== currentRequestId) return
				console.error("Failed to load dashboard data.js version:", error)
				setDashboardDataJsContent(undefined)
			})
			.finally(() => {
				if (requestIdRef.current !== currentRequestId) return
				setIsDashboardContentLoading(false)
			})
	}, [
		dashboardDataJsFile?.file_id,
		dashboardDataJsFile?.updated_at,
		isDashboardHistoryDriven,
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
