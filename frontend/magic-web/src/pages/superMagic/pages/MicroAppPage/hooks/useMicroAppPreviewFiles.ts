import { useEffect, useMemo, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import type { HtmlNavigationRequest } from "@/pages/superMagic/components/Detail/contents/HTML/utils/html-navigation"
import {
	collectHtmlFiles,
	getAttachmentId,
	getMicroAppPreviewPath,
	isSamePreviewEntryFile,
} from "../utils/microAppFiles"

export type MicroAppPreviewFile = AttachmentItem & { htmlNavigation?: HtmlNavigationRequest }
export interface MicroAppPreviewTab {
	id: string
	name?: string
	file: MicroAppPreviewFile
	revision: number
}
interface PreviewSession {
	scope: string
	tabs: MicroAppPreviewTab[]
	activeId: string
	closedAll?: boolean
}

/** Browsing contexts have their own identity: two _blank opens of one URL are two pages. */
export function useMicroAppPreviewFiles({
	attachmentList,
	defaultEntryFile,
	scopeKey = "",
	allowCloseLastTab = false,
}: {
	attachmentList: AttachmentItem[]
	defaultEntryFile: AttachmentItem | null
	scopeKey?: string
	allowCloseLastTab?: boolean
}) {
	const sequence = useRef(0)
	const createTab = (file: MicroAppPreviewFile, name?: string): MicroAppPreviewTab => ({
		id: `page-${++sequence.current}`,
		file,
		name,
		revision: 0,
	})
	const [session, setSession] = useState<PreviewSession>(() => {
		const first = defaultEntryFile ? createTab(defaultEntryFile) : null
		return { scope: scopeKey, tabs: first ? [first] : [], activeId: first?.id || "" }
	})
	const previewHtmlFiles = useMemo(() => collectHtmlFiles(attachmentList), [attachmentList])
	const filesById = useMemo(
		() => new Map(previewHtmlFiles.map((file) => [getAttachmentId(file), file])),
		[previewHtmlFiles],
	)
	// Never expose the previous app's mounted documents while its next scope initializes.
	const previewTabs = session.scope === scopeKey ? session.tabs : []
	const activePreviewTabId = session.scope === scopeKey ? session.activeId : ""
	const previewEntryFile = previewTabs.find((tab) => tab.id === activePreviewTabId)?.file || null

	useEffect(() => {
		setSession((previous) => {
			const tabs =
				previous.scope === scopeKey
					? previous.tabs.flatMap((tab) => {
							const latest = filesById.get(getAttachmentId(tab.file))
							if (!latest) return []
							if (
								isSamePreviewEntryFile(tab.file, latest) &&
								getMicroAppPreviewPath(tab.file) === getMicroAppPreviewPath(latest)
							)
								return [tab]
							// Attachment refresh must not erase the page's query/hash or reset sibling contexts.
							return [
								{
									...tab,
									file: tab.file.htmlNavigation
										? { ...latest, htmlNavigation: tab.file.htmlNavigation }
										: latest,
								},
							]
						})
					: []
			const closedAll = previous.scope === scopeKey && previous.closedAll === true
			if (!tabs.length && defaultEntryFile && !closedAll)
				tabs.push(createTab(defaultEntryFile))
			const activeId = tabs.some((tab) => tab.id === previous.activeId)
				? previous.activeId
				: tabs[0]?.id || ""
			if (
				previous.scope === scopeKey &&
				activeId === previous.activeId &&
				tabs.length === previous.tabs.length &&
				tabs.every((tab, index) => tab === previous.tabs[index])
			)
				return previous
			return { scope: scopeKey, tabs, activeId, closedAll }
		})
	}, [defaultEntryFile, filesById, scopeKey])

	const handlePreviewOpenFile = useMemoizedFn((fileItem?: unknown, sourceTabId?: string) => {
		if (!fileItem || typeof fileItem !== "object") return
		const requested = fileItem as MicroAppPreviewFile
		const matched = filesById.get(getAttachmentId(requested))
		// Resolve against the current authorized attachment set, never arbitrary message data.
		if (!matched) return
		const file = requested.htmlNavigation
			? { ...matched, htmlNavigation: requested.htmlNavigation }
			: matched
		const target = requested.htmlNavigation?.target || "_self"
		const specialTarget = target.toLowerCase()
		const sameContext = ["_self", "_parent", "_top"].includes(specialTarget)
		const created = createTab(
			file,
			!sameContext && specialTarget !== "_blank" ? target : undefined,
		)
		setSession((previous) => {
			if (previous.scope !== scopeKey) return previous
			const sourceId = sourceTabId || previous.activeId
			if (sourceTabId && !previous.tabs.some((tab) => tab.id === sourceTabId)) return previous
			const existing = sameContext
				? previous.tabs.find((tab) => tab.id === sourceId)
				: specialTarget !== "_blank"
					? previous.tabs.find((tab) => tab.name === target)
					: undefined
			const destinationId = existing?.id || created.id
			const tabs = existing
				? previous.tabs.map((tab) =>
						tab.id === destinationId
							? { ...tab, file, revision: tab.revision + 1 }
							: tab,
					)
				: [...previous.tabs, created]
			// A background page navigating itself must not steal focus from the visible page.
			const keepFocus =
				requested.htmlNavigation?.background ||
				(sameContext && sourceId !== previous.activeId)
			return {
				...previous,
				tabs,
				closedAll: false,
				activeId: keepFocus ? previous.activeId : destinationId,
			}
		})
	})
	const handlePreviewTabChange = useMemoizedFn((id: string) => {
		setSession((previous) =>
			previous.tabs.some((tab) => tab.id === id) ? { ...previous, activeId: id } : previous,
		)
	})
	const handlePreviewTabClose = useMemoizedFn((id: string) => {
		setSession((previous) => {
			if (previous.tabs.length <= 1 && !allowCloseLastTab) return previous
			const index = previous.tabs.findIndex((tab) => tab.id === id)
			if (index < 0) return previous
			const tabs = previous.tabs.filter((tab) => tab.id !== id)
			return {
				...previous,
				tabs,
				closedAll: tabs.length === 0,
				activeId:
					previous.activeId === id
						? tabs[Math.min(index, tabs.length - 1)]?.id || ""
						: previous.activeId,
			}
		})
	})
	const handlePreviewRefresh = useMemoizedFn(() => {
		setSession((previous) => ({
			...previous,
			tabs: previous.tabs.map((tab) =>
				tab.id === previous.activeId ? { ...tab, revision: tab.revision + 1 } : tab,
			),
		}))
	})
	const setPreviewEntryFile = useMemoizedFn((file: AttachmentItem | null) => {
		const first = file ? createTab(file) : null
		setSession({ scope: scopeKey, tabs: first ? [first] : [], activeId: first?.id || "" })
	})
	const handlePreviewFileChange = useMemoizedFn((id: string) => {
		const file = filesById.get(id)
		if (file) handlePreviewOpenFile(file)
	})
	const handlePreviewAddFile = useMemoizedFn((id: string) => {
		const file = filesById.get(id)
		if (!file) return
		handlePreviewOpenFile({
			...file,
			htmlNavigation: {
				filePath: getMicroAppPreviewPath(file),
				search: "",
				hash: "",
				anchor: "",
				target: "_blank",
			},
		})
	})
	const previewFileOptions = useMemo(
		() =>
			previewHtmlFiles.map((file) => ({
				id: getAttachmentId(file),
				path: getMicroAppPreviewPath(file),
			})),
		[previewHtmlFiles],
	)
	return {
		allowCloseLastTab,
		handlePreviewAddFile,
		previewEntryFile,
		setPreviewEntryFile,
		previewTabs,
		activePreviewTabId,
		handlePreviewTabChange,
		handlePreviewTabClose,
		handlePreviewRefresh,
		previewFileOptions,
		activePreviewFileId: previewEntryFile ? getAttachmentId(previewEntryFile) : undefined,
		handlePreviewFileChange,
		handlePreviewOpenFile,
	}
}
export type MicroAppPreviewBrowser = ReturnType<typeof useMicroAppPreviewFiles>
