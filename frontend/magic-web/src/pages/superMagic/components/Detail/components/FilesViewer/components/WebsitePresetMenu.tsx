import { Search, SquarePlus, X } from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import type { MicroAppListItem } from "@/apis/modules/superMagic"
import magicToast from "@/components/base/MagicToaster/utils"
import { isMicroAppEnabled } from "@/services/microAppFeature"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import {
	buildCustomWebsitePreset,
	COMMON_WEBSITE_PRESETS_CHANGE_EVENT,
	getCommonWebsitePresets,
	getWebsitePresets,
	removeCommonWebsitePreset,
	updateCommonWebsitePreset,
} from "../utils/websiteTabs"
import type { FileItem, WebsitePreset } from "../types"
import CommonWebsitePresetDialog, {
	type CommonWebsitePresetFormValues,
} from "./CommonWebsitePresetDialog"
import { flattenFiles, getFileTitle, looksLikeUrl } from "./QuickOpenItem"
import {
	EmptyResults,
	FileResults,
	MicroAppResults,
	QuickOpenSectionNav,
	type QuickOpenSection,
	type QuickOpenSectionItem,
	WebsiteResults,
} from "./QuickOpenSections"

interface WebsitePresetMenuProps {
	onOpenWebsiteTab: (preset: WebsitePreset) => void
	onOpenMicroAppTab?: (data: { appId: string; appName?: string }) => void
	onOpenFileTab?: (fileItem: FileItem) => void
	fileAttachments?: FileItem[]
}

function getTranslatedPreset(preset: WebsitePreset, t: (key: string) => string): WebsitePreset {
	return {
		...preset,
		title: preset.titleKey ? t(preset.titleKey) : preset.title || preset.id,
		description: preset.descriptionKey ? t(preset.descriptionKey) : preset.description || "",
	}
}

const WebsitePresetMenu = memo(function WebsitePresetMenu({
	onOpenWebsiteTab,
	onOpenMicroAppTab,
	onOpenFileTab,
	fileAttachments = [],
}: WebsitePresetMenuProps) {
	const { t } = useTranslation("super")
	const [open, setOpen] = useState(false)
	const [activeSection, setActiveSection] = useState<QuickOpenSection>("all")
	const [searchQuery, setSearchQuery] = useState("")
	const [commonWebsitePresets, setCommonWebsitePresets] = useState(() =>
		getCommonWebsitePresets(),
	)
	const [editingPreset, setEditingPreset] = useState<WebsitePreset | null>(null)
	const [microApps, setMicroApps] = useState<MicroAppListItem[]>([])
	const [microAppsLoading, setMicroAppsLoading] = useState(false)
	const [microAppsLoadingMore, setMicroAppsLoadingMore] = useState(false)
	const [microAppsHasMore, setMicroAppsHasMore] = useState(false)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const scrollViewportRef = useRef<HTMLDivElement>(null)
	const microAppsPageRef = useRef(0)
	const microAppsRequestRef = useRef(0)
	const flattenedFiles = useMemo(() => flattenFiles(fileAttachments), [fileAttachments])
	const normalizedQuery = searchQuery.trim().toLowerCase()
	const matchesQuery = useCallback(
		(value: string) => !normalizedQuery || value.toLowerCase().includes(normalizedQuery),
		[normalizedQuery],
	)
	const filteredFiles = useMemo(
		() =>
			flattenedFiles.filter((file) =>
				matchesQuery(
					[getFileTitle(file), file.relative_file_path].filter(Boolean).join(" "),
				),
			),
		[flattenedFiles, matchesQuery],
	)
	const websitePresets = useMemo(
		() =>
			getWebsitePresets()
				.map((preset) => getTranslatedPreset(preset, t))
				.filter((preset) =>
					matchesQuery([preset.title, preset.description].filter(Boolean).join(" ")),
				),
		[matchesQuery, t],
	)
	const visibleCommonWebsitePresets = useMemo(
		() =>
			commonWebsitePresets.filter((preset) =>
				matchesQuery(
					[preset.title, preset.description, preset.url].filter(Boolean).join(" "),
				),
			),
		[commonWebsitePresets, matchesQuery],
	)
	const visibleMicroApps = useMemo(
		() => microApps.filter((microApp) => matchesQuery(microApp.app_name || "")),
		[microApps, matchesQuery],
	)
	const directWebsitePreset = useMemo(
		() =>
			looksLikeUrl(searchQuery)
				? buildCustomWebsitePreset(searchQuery, t("fileViewer.website.customDescription"))
				: null,
		[searchQuery, t],
	)
	const showFiles = activeSection === "all" || activeSection === "files"
	const showWebsites = activeSection === "all" || activeSection === "websites"
	const showMicroApps =
		isMicroAppEnabled() && (activeSection === "all" || activeSection === "microApps")
	const displayedFiles = filteredFiles.slice(0, activeSection === "files" ? 100 : 6)
	const hasVisibleResults =
		(showFiles && displayedFiles.length > 0) ||
		(showWebsites &&
			(Boolean(directWebsitePreset) ||
				websitePresets.length > 0 ||
				visibleCommonWebsitePresets.length > 0)) ||
		(showMicroApps && (visibleMicroApps.length > 0 || microAppsLoading))

	useEffect(() => {
		const syncCommonWebsitePresets = () => {
			setCommonWebsitePresets(getCommonWebsitePresets())
		}

		window.addEventListener("storage", syncCommonWebsitePresets)
		window.addEventListener(COMMON_WEBSITE_PRESETS_CHANGE_EVENT, syncCommonWebsitePresets)
		return () => {
			window.removeEventListener("storage", syncCommonWebsitePresets)
			window.removeEventListener(
				COMMON_WEBSITE_PRESETS_CHANGE_EVENT,
				syncCommonWebsitePresets,
			)
		}
	}, [])

	// Search requests can finish out of order; the request id keeps stale results out.
	const loadMicroApps = useCallback(async (page: number, keyword: string, append: boolean) => {
		if (!isMicroAppEnabled() || typeof SuperMagicApi?.getMentionMicroApps !== "function") {
			return
		}

		const requestId = ++microAppsRequestRef.current
		if (append) setMicroAppsLoadingMore(true)
		else setMicroAppsLoading(true)

		try {
			const response = await SuperMagicApi.getMentionMicroApps({
				page,
				page_size: 20,
				keyword,
			})
			if (requestId !== microAppsRequestRef.current) return

			const nextItems = (Array.isArray(response?.list) ? response.list : []).filter(
				(item) => item.publish_status === "published",
			)
			setMicroApps((current) => (append ? [...current, ...nextItems] : nextItems))
			microAppsPageRef.current = page
			setMicroAppsHasMore(page * (response?.page_size || 20) < (response?.total || 0))
		} catch {
			if (!append && requestId === microAppsRequestRef.current) {
				setMicroApps([])
				setMicroAppsHasMore(false)
			}
		} finally {
			if (requestId === microAppsRequestRef.current) {
				setMicroAppsLoading(false)
				setMicroAppsLoadingMore(false)
			}
		}
	}, [])

	useEffect(() => {
		if (!open || !showMicroApps) return
		const timer = window.setTimeout(() => {
			microAppsPageRef.current = 0
			void loadMicroApps(1, searchQuery.trim(), false)
		}, 200)
		return () => window.clearTimeout(timer)
	}, [loadMicroApps, open, searchQuery, showMicroApps])

	const handleMicroAppsScroll = useCallback(
		(target: HTMLDivElement) => {
			if (
				!showMicroApps ||
				!microAppsHasMore ||
				microAppsLoading ||
				microAppsLoadingMore ||
				target.scrollHeight - target.scrollTop - target.clientHeight > 48
			) {
				return
			}
			void loadMicroApps(microAppsPageRef.current + 1, searchQuery.trim(), true)
		},
		[
			loadMicroApps,
			microAppsHasMore,
			microAppsLoading,
			microAppsLoadingMore,
			searchQuery,
			showMicroApps,
		],
	)

	useEffect(() => {
		const viewport = scrollViewportRef.current
		if (!viewport) return

		const handleScroll = () => handleMicroAppsScroll(viewport)
		viewport.addEventListener("scroll", handleScroll, { passive: true })
		return () => viewport.removeEventListener("scroll", handleScroll)
	}, [handleMicroAppsScroll, open])

	const handleDeleteCommonWebsite = (presetId: string) => {
		removeCommonWebsitePreset(presetId)
		setCommonWebsitePresets(getCommonWebsitePresets())
	}

	const handleSubmitEditCommonWebsite = (values: CommonWebsitePresetFormValues) => {
		if (!editingPreset) return
		const result = updateCommonWebsitePreset(editingPreset.id, values)
		if (result.status === "exists") {
			magicToast.warning(t("fileViewer.website.commonAlreadyExists"))
			return
		}
		if (result.status !== "saved") {
			magicToast.warning(t("fileViewer.website.commonSaveFailed"))
			return
		}

		setEditingPreset(null)
		setCommonWebsitePresets(getCommonWebsitePresets())
		magicToast.success(t("fileViewer.website.commonSaved"))
	}

	const sections: QuickOpenSectionItem[] = [
		{ id: "all", label: t("fileViewer.website.sections.all") },
		{
			id: "files",
			label: t("fileViewer.website.sections.files"),
			count: flattenedFiles.length,
		},
		{
			id: "websites",
			label: t("fileViewer.website.sections.websites"),
			count: getWebsitePresets().length + commonWebsitePresets.length,
		},
	]
	if (isMicroAppEnabled()) {
		sections.push({
			id: "microApps",
			label: t("fileViewer.website.microApps.title"),
			count: microApps.length,
		})
	}

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="group relative ml-1 flex h-7 min-w-7 max-w-7 shrink-0 cursor-pointer select-none items-center gap-1.5 overflow-hidden rounded-md px-1.5 text-xs font-medium text-foreground transition-[max-width,background-color,transform] duration-150 hover:max-w-32 hover:bg-black/10 focus-visible:max-w-32 focus-visible:bg-black/10 active:scale-[0.96] data-[state=open]:bg-black/10 motion-reduce:transition-none"
					aria-label={t("fileViewer.website.quickOpen")}
					data-testid="website-preset-menu-add-button"
				>
					<SquarePlus className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
					<span className="min-w-0 whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
						{t("fileViewer.website.quickOpen")}
					</span>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				sideOffset={8}
				className="flex h-[min(620px,75vh)] w-[min(600px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl p-0 shadow-lg"
				onOpenAutoFocus={(event) => {
					event.preventDefault()
					searchInputRef.current?.focus()
				}}
			>
				<div data-testid="website-preset-menu-header" className="shrink-0 border-b p-3">
					<div className="mb-2.5">
						<div className="text-sm font-medium text-foreground">
							{t("fileViewer.website.quickOpen")}
						</div>
						<div className="mt-0.5 text-xs text-muted-foreground">
							{t("fileViewer.website.quickOpenDescription")}
						</div>
					</div>
					<form
						className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2.5 transition-[border-color,box-shadow] duration-150 focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-primary/20"
						onSubmit={(event) => {
							event.preventDefault()
							if (directWebsitePreset) {
								onOpenWebsiteTab(directWebsitePreset)
								setOpen(false)
							}
						}}
					>
						<Search
							className="size-4 shrink-0 text-muted-foreground"
							aria-hidden="true"
						/>
						<input
							ref={searchInputRef}
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Escape") {
									setOpen(false)
									return
								}
								event.stopPropagation()
							}}
							aria-label={t("fileViewer.website.searchAllPlaceholder")}
							placeholder={t("fileViewer.website.searchAllPlaceholder")}
							className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
							data-testid="quick-open-search-input"
						/>
						{searchQuery ? (
							<button
								type="button"
								className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
								onClick={() => setSearchQuery("")}
								aria-label={t("fileViewer.website.clearSearch")}
							>
								<X className="size-3.5" aria-hidden="true" />
							</button>
						) : null}
					</form>
				</div>

				<div className="grid min-h-0 flex-1 grid-cols-[116px_minmax(0,1fr)]">
					<QuickOpenSectionNav
						activeSection={activeSection}
						onChange={setActiveSection}
						sections={sections}
					/>

					<ScrollArea
						data-testid="website-preset-list"
						className="min-h-0 min-w-0"
						viewportClassName="p-2 [&>div]:!block"
						viewportRef={scrollViewportRef}
					>
						{showFiles ? (
							<FileResults files={displayedFiles} onOpenFile={onOpenFileTab} />
						) : null}
						{showWebsites &&
						(directWebsitePreset ||
							websitePresets.length > 0 ||
							visibleCommonWebsitePresets.length > 0) ? (
							<WebsiteResults
								commonPresets={visibleCommonWebsitePresets}
								directPreset={directWebsitePreset}
								onDeleteCommon={handleDeleteCommonWebsite}
								onEditCommon={setEditingPreset}
								onOpenWebsite={onOpenWebsiteTab}
								presets={websitePresets}
							/>
						) : null}
						{showMicroApps &&
						(microAppsLoading ||
							visibleMicroApps.length > 0 ||
							microAppsLoadingMore) ? (
							<MicroAppResults
								items={visibleMicroApps}
								loading={microAppsLoading}
								loadingMore={microAppsLoadingMore}
								onOpenMicroApp={onOpenMicroAppTab}
							/>
						) : null}
						{!hasVisibleResults ? <EmptyResults /> : null}
					</ScrollArea>
				</div>
			</DropdownMenuContent>
			<CommonWebsitePresetDialog
				open={Boolean(editingPreset)}
				mode="edit"
				initialValues={{
					title: editingPreset?.title || "",
					url: editingPreset?.url || "",
					description: editingPreset?.description || "",
				}}
				onOpenChange={(dialogOpen) => {
					if (!dialogOpen) setEditingPreset(null)
				}}
				onSubmit={handleSubmitEditCommonWebsite}
			/>
		</DropdownMenu>
	)
})

export default WebsitePresetMenu
