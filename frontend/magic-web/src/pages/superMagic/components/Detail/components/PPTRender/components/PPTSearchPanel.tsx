import { useId } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import MagicTooltip from "@/components/base/MagicTooltip"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { usePPTTextSearch, type PPTTextSearchOptions } from "../hooks/usePPTTextSearch"

export interface PPTSearchPanelProps extends PPTTextSearchOptions {
	onOpenChange: (open: boolean) => void
	hiddenPaths?: ReadonlySet<string>
}

const PPTSearchPanel = observer(function PPTSearchPanel(props: PPTSearchPanelProps) {
	const { t } = useTranslation("super")
	const search = usePPTTextSearch(props)
	const id = useId()
	const locked = props.busy || search.saving
	const failed = search.pages.filter((page) => page.failed)
	const unsupported = search.matches.filter(({ match }) => !match.replaceable).length
	const pageNumber = (fileId: string, fallback: number) => {
		const index = props.store.slides.findIndex(
			(slide) => props.store.getFileIdByPath(slide.path) === fileId,
		)
		return index < 0 ? fallback : index + 1
	}
	const statuses = {
		success: t("ppt.search.saved"),
		conflict: t("ppt.search.conflict"),
		unknown: t("ppt.search.unknown"),
		failed: t("ppt.search.failed"),
		cancelled: t("ppt.search.cancelled"),
	}
	return (
		<Dialog
			open={props.open}
			onOpenChange={(open) => {
				if (!search.saving) props.onOpenChange(open)
			}}
		>
			<DialogContent
				className="flex max-h-[85vh] flex-col gap-4 sm:max-w-2xl"
				showCloseButton={!search.saving}
			>
				<DialogHeader>
					<DialogTitle>{t("ppt.search.title")}</DialogTitle>
					<DialogDescription>{t("ppt.search.description")}</DialogDescription>
				</DialogHeader>
				{search.phase === "search" ? (
					<>
						<div className="grid gap-3">
							<div className="grid gap-2">
								<Label htmlFor={`${id}-query`}>{t("ppt.search.query")}</Label>
								<Input
									id={`${id}-query`}
									value={search.query}
									onChange={(event) => search.setQuery(event.target.value)}
									disabled={locked}
								/>
							</div>
							<div className="flex flex-wrap items-center gap-4">
								<Select
									value={search.scope}
									onValueChange={(value) =>
										search.setScope(value === "selected" ? "selected" : "all")
									}
									disabled={locked}
								>
									<SelectTrigger aria-label={t("ppt.search.scope")}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">
											{t("ppt.search.allPages")}
										</SelectItem>
										<SelectItem value="selected">
											{t("ppt.search.selectedPages")}
										</SelectItem>
									</SelectContent>
								</Select>
								<Label className="font-normal">
									<Checkbox
										checked={search.caseSensitive}
										onCheckedChange={(value) =>
											search.setCaseSensitive(value === true)
										}
										disabled={locked}
									/>
									{t("ppt.search.caseSensitive")}
								</Label>
							</div>
							{props.allowEdit ? (
								<div className="grid gap-2">
									<Label htmlFor={`${id}-replacement`}>
										{t("ppt.search.replacement")}
									</Label>
									<Input
										id={`${id}-replacement`}
										value={search.replacement}
										onChange={(event) =>
											search.setReplacement(event.target.value)
										}
										disabled={locked}
									/>
								</div>
							) : null}
						</div>
						<div className="flex items-center justify-between gap-2">
							<p role="status" className="text-sm text-muted-foreground">
								{search.scanning
									? t("ppt.search.progress", search.progress)
									: t("ppt.search.resultCount", {
											count: search.matches.length,
											pages: search.pages.filter(
												(page) => page.search?.matches.length,
											).length,
										})}
							</p>
							<div className="flex shrink-0 items-center gap-1">
								<MagicTooltip title={t("ppt.search.previous")}>
									<Button
										size="icon"
										variant="ghost"
										aria-label={t("ppt.search.previous")}
										disabled={!search.matches.length || locked}
										onClick={() =>
											void search.navigate(
												(search.active + search.matches.length - 1) %
													search.matches.length,
											)
										}
									>
										<ChevronUp className="size-4" />
									</Button>
								</MagicTooltip>
								<MagicTooltip title={t("ppt.search.next")}>
									<Button
										size="icon"
										variant="ghost"
										aria-label={t("ppt.search.next")}
										disabled={!search.matches.length || locked}
										onClick={() =>
											void search.navigate(
												(search.active + 1) % search.matches.length,
											)
										}
									>
										<ChevronDown className="size-4" />
									</Button>
								</MagicTooltip>
							</div>
						</div>
						{/* A bounded shared viewport keeps actions visible while results grow. */}
						<ScrollArea className="min-h-24 flex-1" viewportClassName="max-h-[35vh]">
							<div className="space-y-2 pr-3">
								{!search.query ? (
									<p className="py-6 text-center text-sm text-muted-foreground">
										{t("ppt.search.start")}
									</p>
								) : null}
								{search.query && !search.scanning && !search.matches.length ? (
									<p className="py-6 text-center text-sm text-muted-foreground">
										{failed.length
											? t("ppt.search.noScannedMatches")
											: t("ppt.search.noMatches")}
									</p>
								) : null}
								{search.matches.map(({ page, match }, index) => (
									<button
										key={`${page.fileId}-${match.id}`}
										type="button"
										aria-current={search.active === index ? "true" : undefined}
										disabled={locked}
										className="w-full rounded-md border border-border p-3 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=true]:bg-accent"
										onClick={() => void search.navigate(index)}
									>
										<span className="mb-1 flex gap-2 text-xs text-muted-foreground">
											<span>
												{t("ppt.search.page", {
													page: pageNumber(page.fileId, page.page),
												})}
											</span>
											{props.hiddenPaths?.has(page.path) ? (
												<span>{t("ppt.search.hidden")}</span>
											) : null}
											{!match.replaceable ? (
												<span>{t("ppt.search.cannotReplace")}</span>
											) : null}
										</span>
										<span className="whitespace-pre-wrap break-words">
											{match.context}
										</span>
									</button>
								))}
								{failed.map((page) => (
									<p key={page.path} className="text-sm text-destructive">
										{t("ppt.search.notScanned", { page: page.page })}
									</p>
								))}
							</div>
						</ScrollArea>
						{unsupported ? (
							<p className="text-sm text-muted-foreground">
								{t("ppt.search.unsupported", { count: unsupported })}
							</p>
						) : null}
						<div className="flex flex-wrap justify-end gap-2">
							<Button
								variant="outline"
								disabled={locked || search.scanning || !search.query}
								onClick={search.rescan}
							>
								{t("ppt.search.refresh")}
							</Button>
							{props.allowEdit ? (
								<>
									<Button
										variant="outline"
										disabled={
											locked ||
											search.scanning ||
											!search.current?.match.replaceable
										}
										onClick={() => search.preview(false)}
									>
										{t("ppt.search.replaceOne")}
									</Button>
									<Button
										disabled={
											locked ||
											search.scanning ||
											!search.matches.length ||
											unsupported > 0
										}
										onClick={() => search.preview(true)}
									>
										{t("ppt.search.replaceAll")}
									</Button>
								</>
							) : null}
						</div>
					</>
				) : (
					<>
						<p className="text-sm">
							{search.phase === "preview"
								? t("ppt.search.preview", {
										pages: search.plan.length,
										count: search.plan.reduce(
											(sum, entry) => sum + entry.matchIds.length,
											0,
										),
									})
								: t("ppt.search.complete", {
										success: search.plan.filter(
											(entry) => entry.outcome === "success",
										).length,
										conflict: search.plan.filter(
											(entry) => entry.outcome === "conflict",
										).length,
										failed: search.plan.filter(
											(entry) => entry.outcome === "failed",
										).length,
									})}
						</p>
						<ScrollArea className="min-h-24 flex-1" viewportClassName="max-h-[45vh]">
							<div className="space-y-3 pr-3">
								{search.plan.map((entry) => (
									<section
										key={entry.page.fileId}
										className="space-y-2 rounded-md border border-border p-3 text-sm"
									>
										<div className="flex flex-wrap justify-between gap-2">
											<h3>
												{t("ppt.search.page", {
													page: pageNumber(
														entry.page.fileId,
														entry.page.page,
													),
												})}
											</h3>
											<span>
												{entry.outcome
													? statuses[entry.outcome]
													: t("ppt.search.matchCount", {
															count: entry.matchIds.length,
														})}
											</span>
										</div>
										{entry.matchIds.map((matchId) => (
											<div key={matchId} className="grid grid-cols-2 gap-3">
												<div>
													<p className="mb-1 text-xs text-muted-foreground">
														{t("ppt.search.before")}
													</p>
													<p className="whitespace-pre-wrap break-words">
														{entry.page.search?.matches[matchId].text}
													</p>
												</div>
												<div>
													<p className="mb-1 text-xs text-muted-foreground">
														{t("ppt.search.after")}
													</p>
													<p className="whitespace-pre-wrap break-words">
														{search.replacement ||
															t("ppt.search.emptyReplacement")}
													</p>
												</div>
											</div>
										))}
									</section>
								))}
							</div>
						</ScrollArea>
						{search.plan.some((entry) => entry.outcome === "unknown") ? (
							<p role="alert" className="text-sm text-destructive">
								{t("ppt.search.unknownHelp")}
							</p>
						) : null}
						{search.refreshFailed ? (
							<p role="alert" className="text-sm text-muted-foreground">
								{t("ppt.search.refreshFailed")}
							</p>
						) : null}
						<div className="flex flex-wrap justify-end gap-2">
							{search.saving ? (
								<Button
									variant="outline"
									disabled={search.cancelled}
									onClick={search.cancel}
								>
									<Loader2 className="mr-2 size-4 animate-spin" />
									{search.cancelled
										? t("ppt.search.cancelling")
										: t("ppt.search.cancel")}
								</Button>
							) : search.phase === "preview" ? (
								<>
									<Button variant="outline" onClick={search.back}>
										{t("ppt.search.back")}
									</Button>
									<Button
										disabled={locked || !props.allowEdit}
										onClick={() => void search.confirm()}
									>
										{t("ppt.search.confirm")}
									</Button>
								</>
							) : (
								<Button onClick={search.rescan}>{t("ppt.search.refresh")}</Button>
							)}
						</div>
					</>
				)}
				{search.error ? (
					<p role="alert" className="text-sm text-destructive">
						{t("ppt.search.error")}
					</p>
				) : null}
			</DialogContent>
		</Dialog>
	)
})

export default PPTSearchPanel
