import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDeepCompareEffect, useMemoizedFn } from "ahooks"
import { Flex } from "antd"
import PPTRender from "../PPTRender"
import MagicSpin from "@/components/base/MagicSpin"
import { useFileData } from "@/pages/superMagic/hooks/useFileData"
import { processHtmlContent } from "../../contents/HTML/htmlProcessor"
import { type FileItem } from "../../contents/HTML/utils/fetchInterceptor"
import { createParentMessageHandler } from "../../contents/HTML/utils/fetchInterceptor"
import type { PPTRootRenderProps } from "./types"
import { flattenAttachments } from "../../contents/HTML/utils"
import { isHtmlPreviewShellNavigation } from "../../contents/HTML/utils/html-navigation"
import { cn } from "@/utils/cn"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { shouldWaitForShareAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import { parseMagicProjectJsContent } from "../../contents/HTML/utils/magicProjectParser"
import { normalizeHiddenSlides } from "@/pages/superMagic/utils/pptHiddenSlides"
import { generateUpdatedMagicProjectJs } from "../../contents/HTML/utils/magicProjectUpdater"
import type { ProjectAttachmentNode } from "../../contents/HTML/utils/file-utils"

const MAGIC_PROJECT_FILE_NAME = "magic.project.js"

interface PendingLocalSlidePaths {
	slidePaths: string[]
	hiddenSlides?: string[]
}

interface PPTEntryData {
	file_id: string
	file_name?: string
	content?: string
	is_directory?: boolean
	relative_file_path?: string
	display_config?: Record<string, any>
	children?: any[]
}

function collectAttachmentNodes(
	items: ProjectAttachmentNode[] | undefined,
): ProjectAttachmentNode[] {
	if (!Array.isArray(items)) return []
	const result: ProjectAttachmentNode[] = []
	const visited = new Set<ProjectAttachmentNode>()
	const stack = [...items].reverse()
	while (stack.length) {
		const item = stack.pop()
		if (!item) continue
		result.push(item)
		// 保留重复节点的覆盖顺序，只省去同一对象 children 的重复展开。
		if (visited.has(item)) continue
		visited.add(item)
		if (!Array.isArray(item.children)) continue
		for (let index = item.children.length - 1; index >= 0; index--) {
			stack.push(item.children[index])
		}
	}
	return result
}

function sameEntryFields(
	previous: PPTRootRenderProps["data"],
	next: PPTRootRenderProps["data"],
): boolean {
	if (previous === next) return true
	if (!previous || !next) return false
	const keys = Object.keys(next) as (keyof PPTRootRenderProps["data"])[]
	return (
		keys.length === Object.keys(previous).length &&
		keys.every(
			(key) =>
				Object.prototype.hasOwnProperty.call(previous, key) &&
				Object.is(previous[key], next[key]),
		)
	)
}

function findAttachmentNodeByFileId(items: any[] | undefined, fileId: string): any | undefined {
	if (!fileId) return undefined
	if (!Array.isArray(items)) return undefined

	const directItem = items.find((item: any) => item?.file_id === fileId)
	if (directItem) return directItem

	for (const item of items) {
		const childItem = findAttachmentNodeByFileId(item?.children, fileId)
		if (childItem) return childItem
	}

	return undefined
}

function mergeAttachmentNodes(items: any[]): any[] {
	const map = new Map<string, any>()
	for (const item of items) {
		const key =
			item?.file_id ||
			item?.relative_file_path ||
			`${getAttachmentFileName(item)}-${item?.parent_id || ""}`
		if (!key) continue

		const existing = map.get(key)
		map.set(key, {
			...(existing || {}),
			...item,
			// Mobile preview details may be partial. Keep the attachment tree's path
			// metadata when the detail payload does not provide a concrete value.
			relative_file_path: item?.relative_file_path ?? existing?.relative_file_path,
			parent_id: item?.parent_id ?? existing?.parent_id,
			children: item?.children || existing?.children,
		})
	}
	return Array.from(map.values())
}

function normalizeFolderPath(relativePath?: string, fileName?: string): string {
	if (!relativePath || !fileName) return ""
	return relativePath.replace(fileName, "")
}

function normalizeDirectoryPath(relativePath?: string): string {
	if (!relativePath) return ""
	const path = relativePath.replace(/\/+$/, "")
	return path ? `${path}/` : ""
}

function getAttachmentFileName(item: any): string {
	return item?.file_name || item?.name || item?.filename || item?.display_filename || ""
}

function getSlidesSignature(slides: string[] | undefined): string {
	return JSON.stringify(slides || [])
}

/**
 * PPTRootRender Component
 * Handles PPT (slide) rendering by extracting slide paths from HTML content
 * and rendering them using the PPTRender component
 */
export default memo(function PPTRootRender(props: PPTRootRenderProps) {
	const {
		data: nextDisplayData,
		attachments,
		type,
		currentIndex,
		onPrevious,
		onNext,
		onFullscreen,
		onDownload,
		totalFiles,
		setUserSelectDetail,
		isFromNode,
		onClose,
		hasUserSelectDetail,
		attachmentList,
		allowEdit,
		saveEditContent,
		className,
		updatedAt,
		displayConfig,
		openFileTab,
		selectedProject,
		activeFileId,
		isPlaybackMode,
		exportFile,
		exportPdf,
		exportPptx,
		allowDownload,
		projectId,
		onRegisterCheckBeforeClose,
		onUnregisterCheckBeforeClose,
		slideStructureAdapter,
		disableMagicProjectLookup = false,
		showRefresh,
	} = props
	// FilesViewer 在切页时重建入口对象；只比较入口自身字段，不能深比较万级附件树。
	// 路径、版本或嵌套快照真正变化时仍更换入口，保留内容与权限的更新语义。
	const entrySnapshotRef = useRef(nextDisplayData)
	if (!sameEntryFields(entrySnapshotRef.current, nextDisplayData)) {
		entrySnapshotRef.current = nextDisplayData
	}
	const displayData = entrySnapshotRef.current

	const [filePathMapping, setFilePathMapping] = useState<Map<string, string>>(new Map())
	// PPT directory preview appears on share pages; bind the ambient identity so
	// the magic.project.js read is not blocked by the share guard.
	const fileApi = useFileApi()
	const fileAccess = useFileAccess()
	const [originalSlidesPaths, setOriginalSlidesPaths] = useState<string[]>([])
	const [parsedHiddenSlides, setParsedHiddenSlides] = useState<string[] | undefined>()
	// The wrapper distinguishes an absent field in a parsed manifest from not parsed yet.
	const [parsedTransitions, setParsedTransitions] = useState<{ value: unknown }>()
	const [renderKey] = useState(0)
	const [entryFileData, setEntryFileData] = useState<any>({})
	const [currentAttachmentList, setCurrentAttachmentList] = useState<any>([])
	const [magicProjectContent, setMagicProjectContent] = useState<string>()
	const [magicProjectLoading, setMagicProjectLoading] = useState(false)
	const pendingLocalSlidePathsRef = useRef<PendingLocalSlidePaths | null>(null)
	const savedConfigGenerationRef = useRef(0)
	const processGenerationRef = useRef(0)
	const entryData = displayData as PPTEntryData | undefined
	// 标记是否至少完成过一次内容解析，避免路径计算中误展示空态
	const [hasProcessedContent, setHasProcessedContent] = useState(false)
	const projectAttachmentNodes = useMemo(
		() =>
			mergeAttachmentNodes([
				...collectAttachmentNodes(attachments),
				...collectAttachmentNodes(attachmentList),
			]),
		[attachments, attachmentList],
	)
	const entryChildren = entryData?.children
	const entryChildNodes = useMemo(() => collectAttachmentNodes(entryChildren), [entryChildren])
	const pptAttachmentList = useMemo(
		() =>
			mergeAttachmentNodes([
				...projectAttachmentNodes,
				...(displayData ? [displayData] : []),
				...entryChildNodes,
			]),
		[projectAttachmentNodes, displayData, entryChildNodes],
	)
	const pptAttachments = useMemo(() => {
		// PPTRender uses attachments as a tree. Keep the source tree when available,
		// while preserving folder previews whose tree only exists on displayData.
		if (attachments?.length) return attachments
		if (Array.isArray(displayData?.children) && displayData.children.length > 0) {
			return [displayData]
		}
		return pptAttachmentList
	}, [attachments, displayData, pptAttachmentList])
	const processAttachments = pptAttachmentList
	const magicProjectFile = useMemo(() => {
		if (disableMagicProjectLookup) return undefined
		if (!displayData?.file_id || pptAttachmentList.length === 0) return undefined

		const entryFile = pptAttachmentList.find(
			(item: any) => item?.file_id === displayData.file_id,
		)
		const isDirectoryEntry = Boolean(entryData?.is_directory)
		const entryFolderPath = isDirectoryEntry
			? normalizeDirectoryPath(entryData?.relative_file_path)
			: normalizeFolderPath(entryFile?.relative_file_path, getAttachmentFileName(entryFile))
		const targetPath = entryFolderPath
			? `${entryFolderPath}${MAGIC_PROJECT_FILE_NAME}`
			: undefined

		return pptAttachmentList.find((item: any) => {
			if (getAttachmentFileName(item) !== MAGIC_PROJECT_FILE_NAME) return false
			if (entryFile?.parent_id && item?.parent_id === entryFile.parent_id) return true
			if (
				isDirectoryEntry &&
				displayData?.file_id &&
				String(item?.parent_id ?? "") === String(displayData.file_id)
			) {
				return true
			}
			return Boolean(targetPath && item?.relative_file_path === targetPath)
		})
	}, [
		disableMagicProjectLookup,
		pptAttachmentList,
		displayData?.file_id,
		entryData?.is_directory,
		entryData?.relative_file_path,
	])

	// 同步派生 slidePaths：解析完成前先用 displayConfig.slides 快速首屏；
	// 一旦 magic.project.js 内容解析完成，就以文件内容为准，避免旧 displayConfig 盖住新 slides。
	const derivedSlidePaths = useMemo(() => {
		if (disableMagicProjectLookup && originalSlidesPaths.length > 0) {
			return originalSlidesPaths
		}
		if (hasProcessedContent && (magicProjectFile?.file_id || originalSlidesPaths.length > 0)) {
			return originalSlidesPaths
		}
		if (
			displayConfig?.slides &&
			Array.isArray(displayConfig.slides) &&
			displayConfig.slides.length > 0
		) {
			return displayConfig.slides
		}
		return originalSlidesPaths
	}, [
		disableMagicProjectLookup,
		displayConfig?.slides,
		hasProcessedContent,
		magicProjectFile?.file_id,
		originalSlidesPaths,
	])

	const entryContentFileId = entryData?.is_directory ? "" : displayData?.file_id || ""
	const effectiveDisplayConfig = useMemo(() => {
		if (disableMagicProjectLookup) return displayConfig
		return {
			...displayConfig,
			slides: derivedSlidePaths,
			// Once parsed, an absent hidden_slides means visible, not stale metadata fallback.
			hidden_slides: parsedHiddenSlides ?? displayConfig?.hidden_slides,
			transitions: parsedTransitions ? parsedTransitions.value : displayConfig?.transitions,
		}
	}, [
		disableMagicProjectLookup,
		displayConfig,
		derivedSlidePaths,
		parsedHiddenSlides,
		parsedTransitions,
	])
	const { fileData: htmlFileData, loading } = useFileData({
		file_id: entryContentFileId,
		isEditing: false,
		updatedAt,
		activeFileId,
		isFromNode,
		content: displayData?.content || "",
		disabledUrlCache: isPlaybackMode,
	})

	useEffect(() => {
		pendingLocalSlidePathsRef.current = null
		savedConfigGenerationRef.current += 1
		processGenerationRef.current += 1
		setParsedHiddenSlides(undefined)
		setParsedTransitions(undefined)
	}, [displayData?.file_id, magicProjectFile?.file_id])

	useEffect(() => {
		const fileId = magicProjectFile?.file_id
		if (!fileId) {
			setMagicProjectContent(undefined)
			setMagicProjectLoading(false)
			return
		}

		let cancelled = false
		const savedGeneration = savedConfigGenerationRef.current
		if (shouldWaitForShareAccess(fileAccess)) {
			setMagicProjectLoading(true)
			return
		}
		setMagicProjectLoading(true)

		fileApi
			.getFileContentById(fileId, { responseType: "text" })
			.then((content) => {
				if (cancelled || savedGeneration !== savedConfigGenerationRef.current) return
				const nextContent = typeof content === "string" ? content : ""
				setMagicProjectContent((prev) => (prev === nextContent ? prev : nextContent))
			})
			.catch((error) => {
				if (cancelled || savedGeneration !== savedConfigGenerationRef.current) return
				console.error("Failed to load magic.project.js content:", error)
				setMagicProjectContent(undefined)
			})
			.finally(() => {
				if (!cancelled) setMagicProjectLoading(false)
			})

		return () => {
			cancelled = true
		}
	}, [magicProjectFile?.file_id, magicProjectFile?.updated_at, fileApi, fileAccess])

	/** Update HTML file data content */
	const updateDataContent = useMemoizedFn((fileData: any) => {
		const newEntryFileData = {
			...displayData,
			content: fileData || displayData?.content,
		}
		if (entryFileData.content !== newEntryFileData.content) {
			setEntryFileData(newEntryFileData)
		}
	})

	useDeepCompareEffect(() => {
		updateDataContent(htmlFileData)
	}, [htmlFileData])

	// Create message handler and register/remove listener
	useEffect(() => {
		if (shouldWaitForShareAccess(fileAccess)) return
		let htmlRelativeFolderPath = "/"
		const currentFileId = displayData?.file_id
		if (currentFileId && pptAttachmentList.length > 0) {
			const currentFile = pptAttachmentList.find((item) => item.file_id === currentFileId)
			if (currentFile?.is_directory && currentFile.relative_file_path) {
				htmlRelativeFolderPath = normalizeDirectoryPath(currentFile.relative_file_path)
			} else if (currentFile && currentFile.relative_file_path && currentFile.file_name) {
				htmlRelativeFolderPath = currentFile.relative_file_path.replace(
					currentFile.file_name,
					"",
				)
			}
		}
		const allFiles = flattenAttachments(pptAttachmentList) as FileItem[]
		const messageHandler = createParentMessageHandler(
			allFiles,
			htmlRelativeFolderPath,
			currentFileId || "",
			undefined,
			fileAccess,
			fileApi,
		)
		window.addEventListener("message", messageHandler)
		return () => {
			window.removeEventListener("message", messageHandler)
		}
	}, [pptAttachmentList, displayData?.file_id, fileAccess, fileApi])

	const processContent = useMemoizedFn(async () => {
		const generation = ++processGenerationRef.current
		try {
			const shouldUseMagicProject = Boolean(
				magicProjectFile?.file_id && magicProjectContent !== undefined,
			)
			const content = shouldUseMagicProject ? magicProjectContent : entryFileData?.content
			const parsedConfig = !disableMagicProjectLookup
				? parseMagicProjectJsContent(content || "")
				: null
			const nextHiddenSlides = parsedConfig
				? normalizeHiddenSlides(parsedConfig.slides, parsedConfig.config.hidden_slides)
				: undefined
			const result = await processHtmlContent({
				content,
				attachments: processAttachments,
				fileId: shouldUseMagicProject ? magicProjectFile?.file_id : displayData?.file_id,
				fileName: shouldUseMagicProject
					? getAttachmentFileName(magicProjectFile)
					: entryFileData?.file_name,
				attachmentList: pptAttachmentList,
				displayConfig,
				fileApi,
			})

			if (generation !== processGenerationRef.current) return

			if (shouldUseMagicProject && pendingLocalSlidePathsRef.current) {
				const pendingLocalSlidePaths = pendingLocalSlidePathsRef.current
				const isMagicProjectCaughtUp =
					getSlidesSignature(result.originalSlidesPaths) ===
						getSlidesSignature(pendingLocalSlidePaths.slidePaths) &&
					(pendingLocalSlidePaths.hiddenSlides === undefined ||
						getSlidesSignature(nextHiddenSlides) ===
							getSlidesSignature(pendingLocalSlidePaths.hiddenSlides))

				if (!isMagicProjectCaughtUp) {
					return
				}

				pendingLocalSlidePathsRef.current = null
			}

			setFilePathMapping(result.filePathMapping)
			setOriginalSlidesPaths(result.originalSlidesPaths)
			if (nextHiddenSlides !== undefined) setParsedHiddenSlides(nextHiddenSlides)
			if (parsedConfig) setParsedTransitions({ value: parsedConfig.config.transitions })
		} catch (error) {
			if (generation !== processGenerationRef.current) return
			console.error("Error processing HTML content for PPT:", error)
			setOriginalSlidesPaths([])
		} finally {
			if (generation === processGenerationRef.current) setHasProcessedContent(true)
		}
	})

	useDeepCompareEffect(() => {
		// attachmentList 先到时不立即解析，等待 entryFileData.content 就绪
		if (
			(entryFileData?.content || magicProjectContent !== undefined) &&
			currentAttachmentList.length === 0 &&
			pptAttachmentList.length > 0
		) {
			setCurrentAttachmentList(pptAttachmentList)
			processContent()
		}
	}, [pptAttachmentList, currentAttachmentList, entryFileData?.content, magicProjectContent])

	useDeepCompareEffect(() => {
		if (!entryFileData?.content && magicProjectContent === undefined) return
		// 首次由 attachmentList 分支接管，避免首轮重复解析
		if (currentAttachmentList.length === 0 && pptAttachmentList.length) return
		processContent()
	}, [
		entryFileData,
		magicProjectContent,
		displayConfig,
		currentAttachmentList.length,
		pptAttachmentList.length,
	])

	// Handle sort panel save
	const handleSortSave = useCallback((newSlidesPaths: string[]) => {
		pendingLocalSlidePathsRef.current = {
			slidePaths: newSlidesPaths,
		}
		setOriginalSlidesPaths(newSlidesPaths)
	}, [])

	const handleDeckConfigSaved = useCallback((config: Record<string, unknown>) => {
		if (!Array.isArray(config.slides)) return
		const slidePaths = config.slides.filter((path): path is string => typeof path === "string")
		const hiddenSlides = normalizeHiddenSlides(slidePaths, config.hidden_slides)
		// The confirmed save is itself a fresh snapshot. Invalidate older downloads and
		// parses so a delayed pre-save response cannot restore the previous settings.
		savedConfigGenerationRef.current += 1
		processGenerationRef.current += 1
		setMagicProjectContent(generateUpdatedMagicProjectJs(config, slidePaths))
		// Confirmed saves do not wait for an exact server echo: a newer remote save
		// may already supersede this snapshot while its HTML processing is pending.
		pendingLocalSlidePathsRef.current = null
		setOriginalSlidesPaths(slidePaths)
		setParsedHiddenSlides(hiddenSlides)
		setParsedTransitions({ value: config.transitions })
	}, [])

	const handleDownload = useMemoizedFn(
		({
			fileId,
			fileVersion,
			type,
		}: {
			fileId: string
			fileVersion?: number
			type?: "file" | "pdf" | "pptx"
		}) => {
			if (type === "file") {
				exportFile?.(fileId, fileVersion)
			} else if (type === "pdf") {
				exportPdf?.(fileId)
			} else if (type === "pptx") {
				exportPptx?.(fileId)
			}
		},
	)

	const openNewTab = useCallback(
		(fileId: string, path: string) => {
			if (!fileId) {
				console.warn("openNewTab: fileId is empty, cannot open new tab")
				return
			}

			// Ignore husky/shell rewrites from canceling slide edit.
			if (isHtmlPreviewShellNavigation(path)) return

			const fileItem = findAttachmentNodeByFileId(pptAttachmentList, fileId)
			if (!fileItem) {
				console.warn("openNewTab: fileItem not found", { fileId })
				return
			}

			openFileTab?.(fileItem)
		},
		[pptAttachmentList, openFileTab],
	)

	// 仅在首次没有任何可渲染 slides 时阻塞；后续 magic.project.js 更新走后台拉取，
	// 保持 PPTRender 常驻，让 slidePaths 变化进入 store 的增量同步链路。
	const hasSlidesFromConfig = displayConfig?.slides?.length > 0
	const hasResolvedSlides = hasProcessedContent || originalSlidesPaths.length > 0
	const canRenderFromExistingState =
		hasSlidesFromConfig ||
		hasResolvedSlides ||
		(!attachmentList?.length && !entryFileData?.content && magicProjectContent === undefined)
	const isInitialEntryLoading = loading && !canRenderFromExistingState
	const isInitialMagicProjectLoading =
		Boolean(magicProjectFile?.file_id && magicProjectLoading) && !canRenderFromExistingState
	const isReadyToRender =
		!isInitialEntryLoading && !isInitialMagicProjectLoading && canRenderFromExistingState

	return (
		<div
			className={cn("h-full w-full", className)}
			data-testid={props.isTabActive === false ? undefined : "ppt-project-preview"}
		>
			{!isReadyToRender ? (
				<Flex
					justify="center"
					align="center"
					className="h-full w-full bg-background"
					data-testid={
						props.isTabActive === false ? undefined : "ppt-project-preview-loading"
					}
				>
					<MagicSpin spinning />
				</Flex>
			) : (
				<PPTRender
					attachmentLoadState={props.attachmentLoadState}
					key={`ppt-${renderKey}`}
					slidePaths={derivedSlidePaths}
					attachments={pptAttachments}
					attachmentList={pptAttachmentList}
					projectId={projectId}
					mainFileId={displayData?.file_id}
					mainFileName={displayData?.file_name}
					filePathMapping={filePathMapping}
					selectedProject={selectedProject}
					displayConfig={effectiveDisplayConfig}
					isPlaybackMode={isPlaybackMode}
					allowEdit={allowEdit}
					saveEditContent={saveEditContent}
					onSortSave={handleSortSave}
					onDeckConfigSaved={handleDeckConfigSaved}
					openNewTab={openNewTab}
					onDownload={handleDownload}
					onFullscreen={onFullscreen}
					isFileFullscreen={props.isFullscreen}
					onActiveIndexChange={(_index, fileId) => {
						props.onActiveFileChange?.(fileId)
					}}
					isTabActive={props.isTabActive}
					allowDownload={allowDownload}
					showRefresh={showRefresh}
					onRegisterCheckBeforeClose={onRegisterCheckBeforeClose}
					onUnregisterCheckBeforeClose={onUnregisterCheckBeforeClose}
					slideStructureAdapter={slideStructureAdapter}
				/>
			)}
		</div>
	)
})
