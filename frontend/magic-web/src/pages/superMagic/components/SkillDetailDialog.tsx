import { observer } from "mobx-react-lite"
import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
	Award,
	BadgeInfo,
	ChevronDown,
	ChevronsDown,
	CircleUserRound,
	Clock3,
	GalleryHorizontalEnd,
	Loader2,
	ShieldCheck,
	X,
} from "lucide-react"
import { type VariantProps } from "class-variance-authority"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import SmartTooltip from "@/components/other/SmartTooltip"
import { Button, buttonVariants } from "@/components/shadcn-ui/button"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/shadcn-ui/collapsible"
import { Dialog, DialogContent } from "@/components/shadcn-ui/dialog"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Separator } from "@/components/shadcn-ui/separator"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { cn } from "@/lib/utils"
import { SkillThumbnail } from "@/pages/superMagic/components/SkillThumbnail"
import { downloadFileContent } from "@/pages/superMagic/utils/api"
import {
	skillsService,
	type SkillDetailView,
	type StoreSkillView,
	type UserSkillView,
} from "@/services/skills/SkillsService"
import { normalizeLocale } from "@/utils/locale"
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor"

interface SkillDetailDialogAction {
	label: string
	onClick: () => Promise<void> | void
	variant?: VariantProps<typeof buttonVariants>["variant"]
	/** Merged with base full-width styles (e.g. destructive tint for uninstall). */
	className?: string
	disabled?: boolean
	testId: string
}

interface SkillDetailDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	skillCode: string | null
	detailSource: "market" | "user"
	skillSummary?: StoreSkillView | UserSkillView | null
	primaryAction?: SkillDetailDialogAction
}

interface SkillDetailMetaItem {
	key: string
	icon: ReactNode
	label: string
	testId: string
	className?: string
}

function formatSkillUpdatedDateTime(value: string, i18nLanguage: string) {
	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) return value
	const localeTag = normalizeLocale(i18nLanguage).replace("_", "-")

	try {
		return new Intl.DateTimeFormat(localeTag, {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(parsed)
	} catch {
		return value
	}
}

function normalizeDisplayText(value?: string | null) {
	const normalizedValue = value?.trim()
	if (!normalizedValue) return null
	return normalizedValue
}

function resolvePublisherLabel(
	detail: SkillDetailView | null,
	t: (key: string) => string,
): string | null {
	if (!detail) return null

	const publisherName = normalizeDisplayText(detail.publisherName)
	if (
		publisherName &&
		detail.publisherType !== "OFFICIAL" &&
		detail.publisherType !== "OFFICIAL_BUILTIN"
	)
		return publisherName
	if (detail.publisherType === "OFFICIAL") return t("skillsLibrary.official")
	if (detail.publisherType === "OFFICIAL_BUILTIN") return t("employeeCard.officialBuiltin")
	if (detail.publisherType === "VERIFIED_CREATOR") return t("employeeCard.publisherVerified")
	if (detail.publisherType === "PARTNER") return t("employeeCard.publisherPartner")
	if (detail.publisherType === "USER") return publisherName || t("employeeCard.publisherUser")
	return publisherName
}

function buildMetaItems({
	detail,
	language,
	t,
}: {
	detail: SkillDetailView | null
	language: string
	t: (key: string, options?: Record<string, unknown>) => string
}): SkillDetailMetaItem[] {
	if (!detail) return []

	const items: SkillDetailMetaItem[] = []
	const versionCode = normalizeDisplayText(detail.versionCode)
	const publisherLabel = resolvePublisherLabel(detail, (key) => t(key))
	const updatedAt = normalizeDisplayText(detail.updatedAt)
	const sourceLabel = normalizeDisplayText(detail.sourceLabel)
	const isFeatured = detail.isFeatured

	if (isFeatured) {
		items.push({
			key: "featured",
			icon: <Award className="size-4 shrink-0" />,
			label: t("skillsLibrary.featured"),
			testId: "skill-detail-dialog-featured",
			className: "text-orange-500 bg-orange-500/10 rounded-md border-transparent px-2 py-0.5",
		})
	}

	if (publisherLabel) {
		items.push({
			key: "publisher",
			icon:
				detail.publisherType === "OFFICIAL" ||
				detail.publisherType === "OFFICIAL_BUILTIN" ? (
					<ShieldCheck className="size-4 shrink-0" />
				) : (
					<CircleUserRound className="size-4 shrink-0" />
				),
			label: publisherLabel,
			testId: "skill-detail-dialog-publisher",
		})
	}

	if (versionCode) {
		items.push({
			key: "version",
			icon: <GalleryHorizontalEnd className="size-4 shrink-0" />,
			label: versionCode.toUpperCase().startsWith("V") ? versionCode : `V${versionCode}`,
			testId: "skill-detail-dialog-version",
		})
	}

	if (updatedAt) {
		items.push({
			key: "updatedAt",
			icon: <Clock3 className="size-4 shrink-0" />,
			label: t("skillsLibrary.updatedAt", {
				dateTime: formatSkillUpdatedDateTime(updatedAt, language),
			}),
			testId: "skill-detail-dialog-updated-at",
		})
	}

	if (sourceLabel) {
		items.push({
			key: "source",
			icon: <BadgeInfo className="size-4 shrink-0" />,
			label: t("skillDetailDialog.source", { source: sourceLabel }),
			testId: "skill-detail-dialog-source",
		})
	}

	return items
}

export const SkillDetailDialog = observer(function SkillDetailDialog({
	open,
	onOpenChange,
	skillCode,
	detailSource,
	skillSummary,
	primaryAction,
}: SkillDetailDialogProps) {
	const { t, i18n } = useTranslation("crew/market")
	const [detail, setDetail] = useState<SkillDetailView | null>(null)
	const [skillMarkdown, setSkillMarkdown] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [isSkillMarkdownLoading, setIsSkillMarkdownLoading] = useState(false)
	const [hasLoadFailed, setHasLoadFailed] = useState(false)
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
	const [isSkillMarkdownExpanded, setIsSkillMarkdownExpanded] = useState(true)
	const [reloadNonce, setReloadNonce] = useState(0)
	const [isActionLoading, setIsActionLoading] = useState(false)

	const normalizedSkillCode = skillCode?.trim() || ""

	const fallbackDetail = useMemo<SkillDetailView | null>(() => {
		if (!skillSummary) return null

		const baseDetail: SkillDetailView = {
			code: skillSummary.skillCode,
			name: skillSummary.name,
			description: skillSummary.description,
			logo: skillSummary.thumbnail || "",
			packageName: skillSummary.packageName,
			versionCode: skillSummary.latestVersion,
			updatedAt: skillSummary.updatedAt,
			skillFileUrl: undefined,
			isFeatured: "status" in skillSummary ? Boolean(skillSummary.isFeatured) : false,
		}

		if ("status" in skillSummary) {
			return {
				...baseDetail,
				publisherType: skillSummary.publisherType,
				publisherName: skillSummary.authorName,
				isAdded: skillSummary.status === "added",
			}
		}

		return {
			...baseDetail,
			publisherType: skillSummary.publisherType,
			publisherName: skillSummary.publisherName,
		}
	}, [skillSummary])

	useEffect(() => {
		if (!open || !normalizedSkillCode) return

		let isDisposed = false

		async function loadSkillDetail() {
			setIsLoading(true)
			setHasLoadFailed(false)
			setDetail(null)
			setSkillMarkdown("")
			setIsDescriptionExpanded(false)
			setIsSkillMarkdownExpanded(true)

			try {
				const nextDetail =
					detailSource === "market"
						? await skillsService.getMarketSkillDetailView(normalizedSkillCode)
						: await skillsService.getUserSkillDetailView(normalizedSkillCode)

				if (isDisposed) return
				setDetail(nextDetail)

				if (!nextDetail.skillFileUrl) return

				setIsSkillMarkdownLoading(true)
				try {
					const markdownContent = await downloadFileContent(nextDetail.skillFileUrl, {
						responseType: "text",
					})
					if (isDisposed || typeof markdownContent !== "string") return
					setSkillMarkdown(markdownContent)
				} catch (error) {
					console.error("Failed to load skill markdown", error)
				} finally {
					if (!isDisposed) setIsSkillMarkdownLoading(false)
				}
			} catch (error) {
				if (isDisposed) return
				setHasLoadFailed(true)
				magicToast.error(t("skillDetailDialog.loadFailed"))
				console.error("Failed to load skill detail", error)
			} finally {
				if (!isDisposed) setIsLoading(false)
			}
		}

		void loadSkillDetail()

		return () => {
			isDisposed = true
		}
	}, [detailSource, normalizedSkillCode, open, reloadNonce, t])

	const displayDetail = detail ?? fallbackDetail
	const displayName =
		normalizeDisplayText(displayDetail?.name) ||
		normalizeDisplayText(fallbackDetail?.name) ||
		normalizedSkillCode ||
		t("skillDetailDialog.emptyName")
	const displayDescription =
		normalizeDisplayText(displayDetail?.description) ||
		normalizeDisplayText(fallbackDetail?.description) ||
		t("mySkills.noDescription")
	const normalizedSkillMarkdown = normalizeDisplayText(skillMarkdown)
	const metaItems = buildMetaItems({
		detail: displayDetail,
		language: i18n.language,
		t,
	})
	const canExpandDescription = displayDescription.length > 220

	async function handlePrimaryAction() {
		if (!primaryAction || primaryAction.disabled || isActionLoading) return

		setIsActionLoading(true)
		try {
			await primaryAction.onClick()
			onOpenChange(false)
		} finally {
			setIsActionLoading(false)
		}
	}

	function handleRetry() {
		setReloadNonce((value) => value + 1)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				overlayClassName="bg-black/50 backdrop-blur-sm"
				className="max-h-[calc(100%-3rem)] w-[calc(100%-2rem)] max-w-[680px] gap-0 overflow-hidden rounded-xl border bg-background p-0 shadow-sm"
				data-testid="skill-detail-dialog"
			>
				<div className="flex h-full max-h-[90vh] w-full min-w-0 flex-col px-3 pb-3 pt-2">
					<div className="relative flex items-center justify-center pb-3">
						<div className="h-1 w-20 rounded-full bg-muted-foreground/30" />
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="absolute right-0 top-0 size-7 rounded-md text-muted-foreground"
							onClick={() => onOpenChange(false)}
							data-testid="skill-detail-dialog-close-button"
						>
							<X className="size-4" aria-hidden />
						</Button>
					</div>

					{isLoading ? (
						<SkillDetailDialogLoading />
					) : hasLoadFailed ? (
						<div
							className="flex flex-col items-center gap-3 py-8 text-center"
							data-testid="skill-detail-dialog-error"
						>
							<p className="text-sm text-muted-foreground">
								{t("skillDetailDialog.loadFailed")}
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={handleRetry}
								data-testid="skill-detail-dialog-retry-button"
							>
								{t("skillDetailDialog.retry")}
							</Button>
						</div>
					) : (
						<div
							className="flex min-h-0 flex-1 flex-col"
							data-testid="skill-detail-dialog-content"
						>
							<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 px-1 pb-1">
								<div className="flex min-w-0 flex-col items-center gap-2 px-3 pt-2">
									<SkillThumbnail
										src={displayDetail?.logo}
										alt={displayName}
										resetKey={normalizedSkillCode}
										iconSize={96}
										className="size-24 rounded-2xl"
										data-testid="skill-detail-dialog-thumbnail"
									/>
									<h2
										className="max-w-full break-words text-center text-2xl font-semibold leading-8 text-foreground"
										data-testid="skill-detail-dialog-title"
									>
										{displayName}
									</h2>
								</div>

								{metaItems.length ? (
									<div
										className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 text-xs text-muted-foreground"
										data-testid="skill-detail-dialog-meta"
									>
										{metaItems.map((item, index) => (
											<div
												key={item.key}
												className={cn("flex items-center gap-3")}
											>
												<div
													className={cn(
														"flex min-w-0 items-center gap-1",
														item.className,
													)}
													data-testid={item.testId}
												>
													{item.icon}
													<SmartTooltip
														elementType="span"
														className="truncate"
														content={item.label}
														sideOffset={4}
													>
														{item.label}
													</SmartTooltip>
												</div>
												{index < metaItems.length - 1 ? (
													<Separator
														orientation="vertical"
														className="!h-3"
													/>
												) : null}
											</div>
										))}
									</div>
								) : null}

								<Collapsible
									open={!canExpandDescription || isDescriptionExpanded}
									onOpenChange={setIsDescriptionExpanded}
								>
									<div
										className="rounded-xl bg-secondary px-3 py-2.5"
										data-testid="skill-detail-dialog-description"
									>
										<p
											className={cn(
												"break-words text-sm leading-6 text-muted-foreground",
												!isDescriptionExpanded &&
													canExpandDescription &&
													"line-clamp-6",
											)}
										>
											{displayDescription}
										</p>
										{canExpandDescription ? (
											<CollapsibleTrigger asChild>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="mt-1.5 h-7 w-full gap-1 text-xs"
													data-testid="skill-detail-dialog-description-toggle"
												>
													{isDescriptionExpanded
														? t("skillDetailDialog.collapse")
														: t("skillDetailDialog.expandAll")}
													<ChevronsDown
														className={cn(
															"size-4 transition-transform",
															isDescriptionExpanded && "rotate-180",
														)}
													/>
												</Button>
											</CollapsibleTrigger>
										) : null}
									</div>
								</Collapsible>

								{primaryAction ? (
									<Button
										type="button"
										variant={primaryAction.variant ?? "default"}
										className={cn(
											"h-10 w-full shadow-xs",
											primaryAction.className,
										)}
										onClick={handlePrimaryAction}
										disabled={primaryAction.disabled || isActionLoading}
										data-testid={primaryAction.testId}
									>
										{isActionLoading ? (
											<Loader2 className="size-4 animate-spin" />
										) : null}
										{primaryAction.label}
									</Button>
								) : null}

								{isSkillMarkdownLoading || normalizedSkillMarkdown ? (
									<div
										className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border"
										data-testid="skill-detail-dialog-skill-file"
									>
										<Collapsible
											open={isSkillMarkdownExpanded}
											onOpenChange={setIsSkillMarkdownExpanded}
											className="flex h-full min-h-0 flex-col"
										>
											<CollapsibleTrigger asChild>
												<Button
													type="button"
													variant="ghost"
													className="flex h-11 w-full items-center justify-between rounded-none px-3 text-sm font-medium"
													data-testid="skill-detail-dialog-skill-file-toggle"
												>
													<span>
														{t("skillDetailDialog.skillFileTitle")}
													</span>
													<ChevronDown
														className={cn(
															"size-4 transition-transform",
															isSkillMarkdownExpanded && "rotate-180",
														)}
													/>
												</Button>
											</CollapsibleTrigger>
											{isSkillMarkdownExpanded ? <Separator /> : null}
											<CollapsibleContent
												className="min-h-0 flex-1"
												data-testid="skill-detail-dialog-skill-file-content"
											>
												<ScrollArea
													className="h-full w-full overflow-hidden"
													viewportClassName="h-full [&>div]:!block"
												>
													<div className="min-w-0 p-4">
														{isSkillMarkdownLoading ? (
															<div className="space-y-3">
																<Skeleton className="h-10 w-48" />
																<Skeleton className="h-5 w-full" />
																<Skeleton className="h-5 w-11/12" />
																<Skeleton className="h-5 w-9/12" />
															</div>
														) : (
															<SimpleEditor
																isEditable={false}
																enableDragHandle={false}
																className="!h-auto !overflow-visible [&_.simple-editor-content]:!h-auto [&_.simple-editor-content]:!overflow-visible [&_.simple-editor]:!p-2"
																content={normalizedSkillMarkdown}
															/>
														)}
													</div>
												</ScrollArea>
											</CollapsibleContent>
										</Collapsible>
									</div>
								) : null}
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
})

function SkillDetailDialogLoading() {
	return (
		<div className="flex flex-col gap-3 px-1 pb-1" data-testid="skill-detail-dialog-loading">
			<div className="flex flex-col items-center gap-2 px-3 pt-2">
				<Skeleton className="size-24 rounded-2xl" />
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-6 w-20 rounded-md" />
			</div>
			<div className="flex items-center justify-center gap-2 px-3">
				<Skeleton className="h-4 w-20" />
				<Skeleton className="h-4 w-28" />
				<Skeleton className="h-4 w-32" />
			</div>
			<Skeleton className="h-32 w-full rounded-xl" />
			<Skeleton className="h-10 w-full rounded-md" />
			{/* <Skeleton className="h-64 w-full rounded-xl" /> */}
		</div>
	)
}
