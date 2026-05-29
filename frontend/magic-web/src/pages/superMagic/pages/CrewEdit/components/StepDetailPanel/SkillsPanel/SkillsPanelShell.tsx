import { memo, useEffect, useMemo, useRef, useState } from "react"
import { X, CirclePlus, ChevronDown, Loader2, Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { FUNCTION_PERMISSION_CODE } from "@/apis"
import type { SkillI18nText, SkillSourceType } from "@/apis/modules/skills"
import { SupportLocales } from "@/constants/locale"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { SmoothTabs } from "@/components/shadcn-ui/smooth-tabs"
import { cn } from "@/lib/utils"
import { SkillDetailDialog } from "@/pages/superMagic/components/SkillDetailDialog"
import { SkillThumbnail } from "@/pages/superMagic/components/SkillThumbnail"
import { useDelayedVisibility } from "@/pages/superMagic/hooks/useDelayedVisibility"
import type { StoreSkillView, UserSkillView } from "@/services/skills/SkillsService"
import { CREW_SKILLS_TAB, type CrewSkillsTab } from "../../../store"
import SkillAddDropdown from "../../SkillAddDropdown"
import SearchBar from "@/pages/superMagic/pages/CrewMarket/components/SearchBar"
import type { SkillPanelItem } from "./useSkillsPanel"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"

function normalizeDisplayText(value?: string | null) {
	const normalizedValue = value?.trim()
	if (!normalizedValue) return null
	return normalizedValue
}

function mapPanelItemToStoreSkillView(skill: SkillPanelItem): StoreSkillView {
	return {
		id: skill.id,
		storeSkillId: skill.id,
		userSkillCode: skill.userSkillCode,
		skillCode: skill.skillCode,
		name: skill.name,
		description: skill.description,
		thumbnail: skill.logo,
		isFeatured: false,
		status: skill.isInUserLibrary ? "added" : "not-added",
		needUpgrade: false,
		updatedAt: new Date(0).toISOString(),
	}
}

function mapPlainTextToSkillI18nText(text: string): SkillI18nText {
	return {
		[SupportLocales.fallback]: text,
		[SupportLocales.zhCN]: text,
		[SupportLocales.enUS]: text,
	}
}

function mapPanelItemToUserSkillView(skill: SkillPanelItem): UserSkillView {
	const code = skill.skillCode
	return {
		id: code,
		userSkillId: code,
		skillCode: code,
		name: skill.name,
		description: skill.description,
		thumbnail: skill.logo,
		nameI18n: mapPlainTextToSkillI18nText(skill.name),
		descriptionI18n: mapPlainTextToSkillI18nText(skill.description),
		logo: skill.logo,
		sourceType: skill.sourceType ?? "MARKET",
		needUpgrade: false,
		updatedAt: new Date(0).toISOString(),
		createdAt: new Date(0).toISOString(),
	}
}

interface SkillListItemProps {
	skill: SkillPanelItem
	isBusy: boolean
	onInstall: (skillCode: string) => void
	onUninstall: (skillCode: string) => void
	onOpenDetail: (skill: SkillPanelItem) => void
	openDetailAriaLabel: string
	testIdPrefix: string
}

function SkillListItem({
	skill,
	isBusy,
	onInstall,
	onUninstall,
	onOpenDetail,
	openDetailAriaLabel,
	testIdPrefix,
}: SkillListItemProps) {
	const { t } = useTranslation(["crew/create", "crew/market"])
	const displayName =
		normalizeDisplayText(skill.name) || t("mySkills.untitledSkill", { ns: "crew/market" })
	const displayDescription =
		normalizeDisplayText(skill.description) ||
		t("mySkills.noDescription", { ns: "crew/market" })
	const shouldShowOfficialBadge =
		skill.sourceType === "SYSTEM" || skill.publisher_type === "OFFICIAL_BUILTIN"

	return (
		<div
			className="relative my-1 flex items-start gap-2.5 px-2.5 py-3"
			data-testid={`${testIdPrefix}-item`}
		>
			<button
				type="button"
				className="absolute inset-0 z-0 rounded-md hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				aria-label={openDetailAriaLabel}
				onClick={() => onOpenDetail(skill)}
				data-testid={`${testIdPrefix}-open-detail`}
			/>
			<div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-start gap-2.5">
				<SkillThumbnail
					src={skill.logo}
					alt={displayName}
					resetKey={skill.skillCode}
					iconSize={40}
					className="size-10 shrink-0"
					data-testid={`${testIdPrefix}-thumbnail`}
				/>

				<div className="flex min-w-0 flex-1 flex-col gap-1.5">
					<div className="flex items-center gap-1.5">
						<span className="truncate text-sm font-medium text-foreground">
							{displayName}
						</span>
						{shouldShowOfficialBadge ? (
							<Badge
								variant="secondary"
								className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium leading-4"
								data-testid={`${testIdPrefix}-official-badge`}
							>
								{t("employeeCard.officialBuiltin", { ns: "crew/market" })}
							</Badge>
						) : null}
					</div>
					<p className="line-clamp-3 text-xs leading-normal text-muted-foreground">
						{displayDescription}
					</p>
				</div>
			</div>

			<div className="relative z-10 shrink-0">
				{skill.status === "not-installed" && (
					<Button
						variant="secondary"
						size="sm"
						className="h-9 min-w-[80px]"
						onClick={() => onInstall(skill.skillCode)}
						disabled={isBusy}
						data-testid={`${testIdPrefix}-install-btn`}
					>
						{isBusy ? <Loader2 className="size-4 animate-spin" /> : t("skills.install")}
					</Button>
				)}
				{skill.status === "installed" && (
					<Button
						variant="ghost"
						size="sm"
						className="h-9 min-w-[80px] bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
						onClick={() => onUninstall(skill.skillCode)}
						disabled={isBusy}
						data-testid={`${testIdPrefix}-uninstall-btn`}
					>
						{isBusy ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							t("skills.uninstall")
						)}
					</Button>
				)}
			</div>
		</div>
	)
}

const SkillListItemMemo = memo(SkillListItem)

export interface SkillsPanelShellProps {
	onClose: () => void
	activeTab: CrewSkillsTab
	setActiveTab: (tab: CrewSkillsTab) => void
	filteredItems: SkillPanelItem[]
	loading: boolean
	loadingMore: boolean
	hasMore: boolean
	busySkills: Set<string>
	handleInstall: (skillCode: string) => void | Promise<void>
	handleUninstall: (skillCode: string) => void | Promise<void>
	handleLoadMore: () => void
	handleImportSuccess: () => void | Promise<void>
	onAddFromLibrary: () => void
	searchQuery: string
	setSearchQuery: (value: string) => void
	onSearch: () => void
	onSearchCompositionStart: () => void
	onSearchCompositionEnd: () => void
	promptPublishAfterImport?: boolean
	importSourceType?: SkillSourceType
	/** Show create button (default true). */
	showCreateButton?: boolean
	/** Prefix for data-testid attributes (default skills-panel). */
	testIdPrefix?: string
	/** Remove top border/radius when nested under another chrome (e.g. mobile drawer). */
	hideTopBorder?: boolean
	/** Hide title/close row when parent popup already renders actionHeader chrome. */
	hideShellHeader?: boolean
}

export function SkillsPanelShell({
	onClose,
	activeTab,
	setActiveTab,
	filteredItems,
	loading,
	loadingMore,
	hasMore,
	busySkills,
	handleInstall,
	handleUninstall,
	handleLoadMore,
	handleImportSuccess,
	onAddFromLibrary,
	searchQuery,
	setSearchQuery,
	onSearch,
	onSearchCompositionStart,
	onSearchCompositionEnd,
	promptPublishAfterImport = true,
	importSourceType,
	showCreateButton = true,
	testIdPrefix = "skills-panel",
	hideTopBorder = false,
	hideShellHeader = false,
}: SkillsPanelShellProps) {
	const { t } = useTranslation("crew/create")
	const { isAllowed: canCreateSkill } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.SkillCreate,
	)
	const [detailSkill, setDetailSkill] = useState<SkillPanelItem | null>(null)

	const sentinelRef = useRef<HTMLDivElement | null>(null)
	const viewportRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		const sentinel = sentinelRef.current
		if (!sentinel || loading || loadingMore || !hasMore) return

		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return
				handleLoadMore()
			},
			{
				root: viewportRef.current,
				rootMargin: "120px 0px",
			},
		)

		observer.observe(sentinel)
		return () => observer.disconnect()
	}, [handleLoadMore, hasMore, loading, loadingMore])
	const shouldShowLoadingMoreIndicator = useDelayedVisibility({
		visible: loadingMore,
	})

	const detailSkillCode = detailSkill?.skillCode?.trim() || null
	const detailSource = activeTab === CREW_SKILLS_TAB.Library ? "market" : "user"
	const detailSummary = detailSkill
		? activeTab === CREW_SKILLS_TAB.Library
			? mapPanelItemToStoreSkillView(detailSkill)
			: mapPanelItemToUserSkillView(detailSkill)
		: null

	const detailPrimaryAction = useMemo(() => {
		if (!detailSkill) return undefined
		const code = detailSkill.skillCode
		const isBusy = busySkills.has(code)
		if (detailSkill.status === "not-installed") {
			return {
				label: t("skills.install"),
				onClick: () => handleInstall(code),
				disabled: isBusy,
				testId: `${testIdPrefix}-detail-install`,
			}
		}
		return {
			label: t("skills.uninstall"),
			variant: "ghost" as const,
			className:
				"bg-destructive/10 text-destructive shadow-none hover:bg-destructive/15 hover:text-destructive",
			onClick: () => handleUninstall(code),
			disabled: isBusy,
			testId: `${testIdPrefix}-detail-uninstall`,
		}
	}, [busySkills, detailSkill, handleInstall, handleUninstall, t, testIdPrefix])

	return (
		<div
			className={cn(
				"flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background",
				hideTopBorder && "rounded-t-none border-t-0",
				hideShellHeader && "rounded-none border-0 bg-mobile-background",
			)}
			data-testid={testIdPrefix}
		>
			<SkillDetailDialog
				open={detailSkill != null}
				onOpenChange={(nextOpen) => {
					if (nextOpen) return
					setDetailSkill(null)
				}}
				skillCode={detailSkillCode}
				detailSource={detailSource}
				skillSummary={detailSummary}
				primaryAction={detailPrimaryAction}
			/>
			<div
				className={cn(
					"flex shrink-0 flex-col gap-3 px-3.5",
					hideShellHeader ? "pt-0" : "pt-3.5",
				)}
			>
				{!hideShellHeader ? (
					<>
						<div className="flex items-center gap-2">
							<h2 className="flex-1 truncate text-2xl font-medium leading-8 text-foreground">
								{t("skills.title")}
							</h2>
							<Button
								variant="ghost"
								size="icon"
								className="size-9 shrink-0"
								onClick={onClose}
								data-testid={`${testIdPrefix}-close`}
							>
								<X className="size-5" />
							</Button>
						</div>

						<Separator />
					</>
				) : null}

				<div className="flex items-center justify-between gap-3">
					<SmoothTabs
						tabs={[
							{ value: CREW_SKILLS_TAB.Library, label: t("skills.library") },
							{ value: CREW_SKILLS_TAB.MySkills, label: t("skills.mySkills") },
						]}
						value={activeTab}
						onChange={setActiveTab}
						variant="background"
						className="h-9 flex-1 bg-muted p-[3px]"
						buttonClassName="rounded-md text-sm py-0 h-[30px]"
						indicatorClassName="h-[30px] inset-y-[3px]"
					/>

					{showCreateButton && canCreateSkill ? (
						<SkillAddDropdown
							onAddFromLibrary={onAddFromLibrary}
							onImportSuccess={handleImportSuccess}
							promptPublishAfterImport={promptPublishAfterImport}
							importSourceType={importSourceType}
						>
							<Button
								size="sm"
								className="h-9 shrink-0 gap-1.5"
								data-testid={`${testIdPrefix}-create-btn`}
							>
								<CirclePlus className="size-4" />
								{t("skills.create")}
								<ChevronDown className="size-4" />
							</Button>
						</SkillAddDropdown>
					) : null}
				</div>
			</div>

			{activeTab === CREW_SKILLS_TAB.Library ? (
				<div className="shrink-0 px-3.5 pt-3">
					<SearchBar
						value={searchQuery}
						onChange={setSearchQuery}
						onSearch={onSearch}
						onCompositionStart={onSearchCompositionStart}
						onCompositionEnd={onSearchCompositionEnd}
						placeholder={t("skills.aiSearchPlaceholder")}
						enableSearchSubmit
						data-testid={`${testIdPrefix}-search-bar`}
					/>
				</div>
			) : null}

			<ScrollArea
				className="min-h-0 flex-1 px-1 pt-2 [&_[data-slot='scroll-area-viewport']>div]:!block"
				viewportRef={viewportRef}
			>
				{loading ? (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="size-6 animate-spin text-muted-foreground" />
					</div>
				) : (
					<div className="flex flex-col px-2.5">
						{filteredItems.map((skill, index) => (
							<div key={skill.id}>
								{index > 0 && <Separator />}
								<SkillListItemMemo
									skill={skill}
									isBusy={busySkills.has(skill.skillCode)}
									onInstall={handleInstall}
									onUninstall={handleUninstall}
									onOpenDetail={setDetailSkill}
									openDetailAriaLabel={t("skills.openSkillDetail")}
									testIdPrefix={testIdPrefix}
								/>
							</div>
						))}
						{!loading && filteredItems.length === 0 && (
							<p className="py-12 text-center text-sm text-muted-foreground">
								{t("skills.emptyTitle")}
							</p>
						)}
						<div
							ref={sentinelRef}
							className="h-1 w-full"
							data-testid={`${testIdPrefix}-scroll-sentinel`}
						/>
						{shouldShowLoadingMoreIndicator ? (
							<div
								className="flex items-center justify-center py-2"
								data-testid={`${testIdPrefix}-loading-more`}
							>
								<Loader2 className="size-4 animate-spin text-muted-foreground" />
								<span className="ml-2 text-xs text-muted-foreground">
									{t("skills.loadingMore")}
								</span>
							</div>
						) : null}
						{!hasMore && filteredItems.length > 0 ? (
							<div
								className="flex items-center justify-center gap-1 py-2 opacity-30"
								data-testid={`${testIdPrefix}-no-more`}
							>
								<Check className="size-4" />
								<span className="text-xs">{t("skills.noMoreData")}</span>
							</div>
						) : null}
					</div>
				)}
			</ScrollArea>
		</div>
	)
}
