import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	type Dispatch,
	type SetStateAction,
} from "react"
import { useSingleDocumentStaticDependencies } from "@/pages/superMagic/hooks/useSingleDocumentStaticDependencies"
import {
	mergeStaticDependencyFileIds,
	type StaticDependencyAttachment,
} from "@/pages/superMagic/utils/staticDependencies"
import { resolveShareDocumentDependencies } from "./resolveShareDocumentDependencies"

interface UseFileShareDocumentDependenciesParams {
	selectedFileIds: string[]
	setSelectedFileIds: Dispatch<SetStateAction<string[]>>
	attachments: StaticDependencyAttachment[]
	shareProject: boolean
	/** Full attachment snapshot used by recording shares for hidden resource lookup. */
	dependencyAttachments?: StaticDependencyAttachment[]
	/** Root folder that bounds recording dependency resolution. */
	dependencyBundleRootPath?: string
	/** Enables multi-document, silent dependency inclusion for recording shares. */
	analyzeSelectedDocuments?: boolean
	autoIncludeDocumentDependencies?: boolean
}

/**
 * Keeps user-selected files separate from dependencies selected automatically for one document.
 * The file tree, dependency option, and final share payload all consume this single state owner.
 */
export function useFileShareDocumentDependencies({
	selectedFileIds,
	setSelectedFileIds,
	attachments,
	shareProject,
	dependencyAttachments = attachments,
	dependencyBundleRootPath,
	analyzeSelectedDocuments = false,
	autoIncludeDocumentDependencies = false,
}: UseFileShareDocumentDependenciesParams) {
	const [includeDocumentDependencies, setIncludeDocumentDependencies] = useState(true)
	const [autoSelectedFileIds, setAutoSelectedFileIds] = useState<string[]>([])
	const [dependencyOwnerFileId, setDependencyOwnerFileId] = useState<string | null>(null)
	const [multiDocumentDependencyFileIds, setMultiDocumentDependencyFileIds] = useState<string[]>(
		[],
	)
	const [multiDocumentDependencyAnalysisError, setMultiDocumentDependencyAnalysisError] =
		useState<Error | null>(null)
	const [isMultiDocumentAnalysisLoading, setIsMultiDocumentAnalysisLoading] = useState(false)

	const autoSelectedFileIdSet = useMemo(() => new Set(autoSelectedFileIds), [autoSelectedFileIds])
	const manuallySelectedFileIds = useMemo(
		() => selectedFileIds.filter((fileId) => !autoSelectedFileIdSet.has(fileId)),
		[selectedFileIds, autoSelectedFileIdSet],
	)
	const selectedFileIdSet = useMemo(() => new Set(selectedFileIds), [selectedFileIds])
	const isDependencyOwnerSelected =
		dependencyOwnerFileId !== null && selectedFileIdSet.has(dependencyOwnerFileId)
	const needsAutoSelectionCleanup =
		autoSelectedFileIds.length > 0 &&
		(!includeDocumentDependencies || !isDependencyOwnerSelected || shareProject)
	const analysisFileId =
		!shareProject && !needsAutoSelectionCleanup
			? isDependencyOwnerSelected
				? dependencyOwnerFileId
				: manuallySelectedFileIds.length === 1
					? manuallySelectedFileIds[0]
					: ""
			: ""
	const staticDependencies = useSingleDocumentStaticDependencies({
		active: Boolean(analysisFileId) && !analyzeSelectedDocuments,
		fileIds: analysisFileId ? [analysisFileId] : [],
		attachments,
	})
	// Static dependency analysis is valid only after a recording bundle has a stable root path.
	// Until then, sharing the currently available recording file must remain available.
	const multiDocumentAnalysisEnabled =
		analyzeSelectedDocuments &&
		autoIncludeDocumentDependencies &&
		Boolean(dependencyBundleRootPath)

	useEffect(() => {
		if (!multiDocumentAnalysisEnabled || shareProject) {
			setMultiDocumentDependencyFileIds([])
			setMultiDocumentDependencyAnalysisError(null)
			setIsMultiDocumentAnalysisLoading(false)
			return
		}

		let cancelled = false
		setIsMultiDocumentAnalysisLoading(true)
		void resolveShareDocumentDependencies({
			selectedFileIds,
			attachments: dependencyAttachments,
			bundleRootPath: dependencyBundleRootPath,
			requireBundleRootPath: multiDocumentAnalysisEnabled,
		})
			.then((result) => {
				if (cancelled) return
				setMultiDocumentDependencyFileIds(result.dependencyFileIds)
				setMultiDocumentDependencyAnalysisError(null)
				if (result.missingResourcePaths.length > 0) {
					console.warn("Some share document resources could not be resolved", result)
				}
			})
			.catch((error) => {
				if (!cancelled) {
					console.warn("Share document dependency analysis failed", error)
					setMultiDocumentDependencyFileIds([])
					setMultiDocumentDependencyAnalysisError(
						error instanceof Error ? error : new Error(String(error)),
					)
				}
			})
			.finally(() => {
				if (!cancelled) setIsMultiDocumentAnalysisLoading(false)
			})

		return () => {
			cancelled = true
		}
	}, [
		multiDocumentAnalysisEnabled,
		dependencyAttachments,
		dependencyBundleRootPath,
		selectedFileIds,
		shareProject,
	])
	const hasCurrentAnalysisResult = staticDependencies.fileId === analysisFileId
	const hasResolvedDependencies =
		hasCurrentAnalysisResult &&
		staticDependencies.fileType !== null &&
		staticDependencies.dependencyFileIds.length > 0
	const isPendingDependencyOwner = dependencyOwnerFileId === null && Boolean(analysisFileId)
	const shouldIncludeDependencies =
		(isDependencyOwnerSelected || isPendingDependencyOwner) &&
		includeDocumentDependencies &&
		(autoSelectedFileIds.length > 0 || hasResolvedDependencies)

	useEffect(() => {
		if (!includeDocumentDependencies || !hasResolvedDependencies || !analysisFileId) return

		const newlyAutoSelectedIds = staticDependencies.dependencyFileIds.filter(
			(fileId) => !selectedFileIds.includes(fileId) && !autoSelectedFileIdSet.has(fileId),
		)
		if (newlyAutoSelectedIds.length === 0) return

		setSelectedFileIds((previousFileIds) => [
			...new Set([...previousFileIds, ...newlyAutoSelectedIds]),
		])
		setAutoSelectedFileIds((previousFileIds) => [
			...new Set([...previousFileIds, ...newlyAutoSelectedIds]),
		])
		setDependencyOwnerFileId((previousFileId) => previousFileId ?? analysisFileId)
	}, [
		analysisFileId,
		autoSelectedFileIdSet,
		hasResolvedDependencies,
		includeDocumentDependencies,
		selectedFileIds,
		setSelectedFileIds,
		staticDependencies.dependencyFileIds,
	])

	useEffect(() => {
		if (!dependencyOwnerFileId || isDependencyOwnerSelected) return

		setDependencyOwnerFileId(null)
		setIncludeDocumentDependencies(true)
	}, [dependencyOwnerFileId, isDependencyOwnerSelected])

	useEffect(() => {
		if (!needsAutoSelectionCleanup) return

		const autoSelectedSet = new Set(autoSelectedFileIds)
		setSelectedFileIds((previousFileIds) =>
			previousFileIds.filter((fileId) => !autoSelectedSet.has(fileId)),
		)
		setAutoSelectedFileIds([])
	}, [autoSelectedFileIds, needsAutoSelectionCleanup, setSelectedFileIds])

	const handleFileIdsChange = useCallback(
		(fileIds: string[]) => {
			const nextSelectedFileIdSet = new Set(fileIds)
			const removedAutoDependency = autoSelectedFileIds.some(
				(fileId) => !nextSelectedFileIdSet.has(fileId),
			)

			// Removing an automatically selected dependency opts out. Unrelated tree changes keep
			// the current document bundle intact.
			if (removedAutoDependency) setIncludeDocumentDependencies(false)
			if (dependencyOwnerFileId && !nextSelectedFileIdSet.has(dependencyOwnerFileId)) {
				setDependencyOwnerFileId(null)
				setIncludeDocumentDependencies(true)
			}
			setSelectedFileIds(fileIds)
		},
		[autoSelectedFileIds, dependencyOwnerFileId, setSelectedFileIds],
	)

	const selectedFileIdsForSubmission = shouldIncludeDependencies
		? selectedFileIds
		: selectedFileIds.filter((fileId) => !autoSelectedFileIdSet.has(fileId))
	const fileIdsForSubmission = useMemo(() => {
		if (multiDocumentAnalysisEnabled) {
			return mergeStaticDependencyFileIds(
				selectedFileIds,
				multiDocumentDependencyFileIds,
				true,
			)
		}

		return mergeStaticDependencyFileIds(
			selectedFileIdsForSubmission,
			staticDependencies.dependencyFileIds,
			shouldIncludeDependencies,
		)
	}, [
		multiDocumentAnalysisEnabled,
		multiDocumentDependencyFileIds,
		selectedFileIds,
		selectedFileIdsForSubmission,
		shouldIncludeDependencies,
		staticDependencies.dependencyFileIds,
	])

	return {
		analysisError:
			multiDocumentDependencyAnalysisError ||
			(analysisFileId && hasCurrentAnalysisResult ? staticDependencies.error : null),
		dependencyFileCount: analyzeSelectedDocuments
			? multiDocumentDependencyFileIds.length
			: staticDependencies.dependencyFileIds.length,
		dependencyFileType: staticDependencies.fileType,
		fileIdsForSubmission,
		handleFileIdsChange,
		includeDocumentDependencies,
		isAnalyzing: multiDocumentAnalysisEnabled
			? isMultiDocumentAnalysisLoading
			: Boolean(analysisFileId) && staticDependencies.isLoading,
		showDependencyOption:
			!analyzeSelectedDocuments && Boolean(analysisFileId) && hasResolvedDependencies,
		setIncludeDocumentDependencies,
	}
}
