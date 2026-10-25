import { Globe2, Loader2, Search, X } from "lucide-react"
import type { MouseEvent } from "react"
import { Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import type { MicroAppListItem } from "@/apis/modules/superMagic"
import MicroAppIcon from "@/components/business/MentionPanel/components/icons/MicroAppIcon"
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/shadcn-ui/context-menu"
import type { FileItem, WebsitePreset } from "../types"
import {
	CommonWebsiteIcon,
	FilePresetIcon,
	getFileDescription,
	getFileTitle,
	QuickOpenRow,
	WebsitePresetIcon,
} from "./QuickOpenItem"

export type QuickOpenSection = "all" | "files" | "websites" | "microApps"

export interface QuickOpenSectionItem {
	count?: number
	id: QuickOpenSection
	label: string
}

export function QuickOpenSectionNav({
	activeSection,
	onChange,
	sections,
}: {
	activeSection: QuickOpenSection
	onChange: (section: QuickOpenSection) => void
	sections: QuickOpenSectionItem[]
}) {
	const { t } = useTranslation("super")
	return (
		<nav
			className="border-r bg-accent/40 p-2"
			aria-label={t("fileViewer.website.sections.label")}
		>
			{sections.map((section) => (
				<button
					key={section.id}
					type="button"
					aria-pressed={activeSection === section.id}
					className="mb-0.5 flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
					onClick={() => onChange(section.id)}
				>
					<span className="min-w-0 flex-1 truncate">{section.label}</span>
					{section.count !== undefined ? (
						<span className="text-[10px] tabular-nums text-muted-foreground">
							{section.count}
						</span>
					) : null}
				</button>
			))}
		</nav>
	)
}

export function FileResults({
	files,
	onOpenFile,
}: {
	files: FileItem[]
	onOpenFile?: (file: FileItem) => void
}) {
	const { t } = useTranslation("super")
	if (files.length === 0) return null

	return (
		<section className="mb-3">
			<div className="px-2 pb-1.5 pt-1 text-xs text-muted-foreground">
				{t("fileViewer.website.sections.files")}
			</div>
			{files.map((file) => (
				<QuickOpenRow
					key={file.file_id}
					ariaLabel={getFileTitle(file)}
					title={getFileTitle(file)}
					description={getFileDescription(file)}
					icon={<FilePresetIcon file={file} />}
					onClick={() => onOpenFile?.(file)}
				/>
			))}
		</section>
	)
}

export function WebsiteResults({
	commonPresets,
	directPreset,
	onDeleteCommon,
	onEditCommon,
	onOpenWebsite,
	presets,
}: {
	commonPresets: WebsitePreset[]
	directPreset: WebsitePreset | null
	onDeleteCommon: (presetId: string) => void
	onEditCommon: (preset: WebsitePreset) => void
	onOpenWebsite: (preset: WebsitePreset) => void
	presets: WebsitePreset[]
}) {
	const { t } = useTranslation("super")
	const handleClose = (event: MouseEvent<HTMLButtonElement>, presetId: string) => {
		event.preventDefault()
		event.stopPropagation()
		onDeleteCommon(presetId)
	}

	return (
		<section className="mb-3">
			<div className="px-2 pb-1.5 pt-1 text-xs text-muted-foreground">
				{t("fileViewer.website.sections.websites")}
			</div>
			{directPreset ? (
				<QuickOpenRow
					ariaLabel={t("fileViewer.website.openCustom")}
					title={t("fileViewer.website.openUrl", { url: directPreset.title })}
					description={directPreset.url}
					icon={
						<span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
							<Globe2 className="size-4" aria-hidden="true" />
						</span>
					}
					onClick={() => onOpenWebsite(directPreset)}
				/>
			) : null}
			{presets.map((preset) => (
				<QuickOpenRow
					key={preset.id}
					ariaLabel={preset.title || preset.id}
					title={preset.title || preset.id}
					description={preset.description}
					icon={<WebsitePresetIcon iconSrc={preset.iconSrc} presetId={preset.id} />}
					onClick={() => onOpenWebsite(preset)}
				/>
			))}
			{commonPresets.map((preset) => (
				<ContextMenu key={preset.id}>
					<ContextMenuTrigger asChild>
						<div className="flex items-center rounded-md">
							<div className="min-w-0 flex-1">
								<QuickOpenRow
									ariaLabel={preset.title || preset.id}
									title={preset.title || preset.id}
									description={preset.url}
									icon={<CommonWebsiteIcon title={preset.title} id={preset.id} />}
									onClick={() => onOpenWebsite(preset)}
								/>
							</div>
							<Tooltip title={t("fileViewer.website.removeCommon")} placement="left">
								<button
									type="button"
									className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
									aria-label={`${t("fileViewer.website.removeCommon")} ${preset.title}`}
									onPointerDown={(event) => event.stopPropagation()}
									onClick={(event) => handleClose(event, preset.id)}
								>
									<X className="size-3.5" aria-hidden="true" />
								</button>
							</Tooltip>
						</div>
					</ContextMenuTrigger>
					<ContextMenuContent>
						<ContextMenuItem onSelect={() => onEditCommon(preset)}>
							{t("fileViewer.website.editCommon")}
						</ContextMenuItem>
						<ContextMenuSeparator />
						<ContextMenuItem
							className="text-destructive focus:text-destructive"
							onSelect={() => onDeleteCommon(preset.id)}
						>
							{t("fileViewer.website.deleteCommon")}
						</ContextMenuItem>
					</ContextMenuContent>
				</ContextMenu>
			))}
		</section>
	)
}

export function MicroAppResults({
	items,
	loading,
	loadingMore,
	onOpenMicroApp,
}: {
	items: MicroAppListItem[]
	loading: boolean
	loadingMore: boolean
	onOpenMicroApp?: (data: { appId: string; appName?: string }) => void
}) {
	const { t } = useTranslation("super")
	return (
		<section>
			<div className="px-2 pb-1.5 pt-1 text-xs text-muted-foreground">
				{t("fileViewer.website.microApps.title")}
			</div>
			{loading ? (
				<div className="flex items-center justify-center gap-2 px-2 py-5 text-xs text-muted-foreground">
					<Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
					{t("fileViewer.website.microApps.loading")}
				</div>
			) : (
				items.map((microApp) => (
					<QuickOpenRow
						key={microApp.app_id}
						ariaLabel={microApp.app_name}
						title={microApp.app_name}
						description={t("fileViewer.website.microApps.title")}
						icon={
							microApp.cover_url ? (
								<img
									src={microApp.cover_url}
									alt=""
									className="size-7 shrink-0 rounded-md object-cover outline outline-1 outline-black/10"
								/>
							) : (
								<MicroAppIcon size={28} />
							)
						}
						onClick={() =>
							onOpenMicroApp?.({ appId: microApp.app_id, appName: microApp.app_name })
						}
					/>
				))
			)}
			{loadingMore ? (
				<div className="flex items-center justify-center gap-2 px-2 py-2 text-xs text-muted-foreground">
					<Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
					{t("fileViewer.website.microApps.loadingMore")}
				</div>
			) : null}
		</section>
	)
}

export function EmptyResults() {
	const { t } = useTranslation("super")
	return (
		<div className="flex min-h-40 flex-col items-center justify-center gap-2 px-4 text-center text-xs text-muted-foreground">
			<Search className="size-5" aria-hidden="true" />
			{t("fileViewer.website.noResults")}
		</div>
	)
}
