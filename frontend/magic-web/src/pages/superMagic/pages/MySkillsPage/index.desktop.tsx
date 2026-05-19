import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { CirclePlus, ChevronDown, Check, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import { FUNCTION_PERMISSION_CODE } from "@/apis"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"
import PageTopBar from "@/pages/superMagic/components/PageTopBar"
import { SkillDetailDialog } from "@/pages/superMagic/components/SkillDetailDialog"
import ImportSkillPublishPromptDialog from "@/pages/superMagic/components/ImportSkillPublishPromptDialog"
import SkillActionDropdown from "@/pages/superMagic/components/SkillActionDropdown"
import { useSkillCreateMenuItems } from "@/pages/superMagic/hooks/useSkillCreateMenuItems"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { useAutoLoadMoreSentinel } from "@/pages/superMagic/hooks/useAutoLoadMoreSentinel"
import { useDelayedVisibility } from "@/pages/superMagic/hooks/useDelayedVisibility"
import type { UserSkillView } from "@/services/skills/SkillsService"
import MySkillCard from "./components/MySkillCard"
import { resolveTeamSharedSkillPermissions } from "./components/MySkillCardShared"
import { UserSkillsStore } from "./stores/user-skills"
import { useMySkillsTabs } from "./hooks/useMySkillsTabs"

function MySkillsPage() {
	const { t } = useTranslation("crew/market")
	const userSkillsStore = useMemo(() => new UserSkillsStore(), [])
	const navigate = useNavigate()
	const { isAllowed: canCreateSkill } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.SkillCreate,
	)
	const scrollViewportRef = useRef<HTMLDivElement | null>(null)
	const [selectedSkill, setSelectedSkill] = useState<UserSkillView | null>(null)
	const {
		activeTab,
		currentScope,
		publishPromptSkillCode,
		setPublishPromptSkillCode,
		tabItems,
		handleTabValueChange,
		setCreatedByMeTab,
		tabCount,
		isCreatedByMeTab,
		isFromSkillsLibraryTab,
	} = useMySkillsTabs({ variant: "desktop" })
	const handleAutoLoadMore = useCallback(() => {
		void userSkillsStore.loadMore()
	}, [userSkillsStore])
	const loadMoreSentinelRef = useAutoLoadMoreSentinel({
		rootRef: scrollViewportRef,
		disabled:
			userSkillsStore.loading || userSkillsStore.loadingMore || !userSkillsStore.hasMore,
		onLoadMore: handleAutoLoadMore,
	})

	useEffect(() => {
		return () => userSkillsStore.reset()
	}, [userSkillsStore])

	useEffect(() => {
		void userSkillsStore.fetchSkills({ page: 1 }, currentScope)
	}, [currentScope, userSkillsStore])
	const shouldShowLoadingMoreIndicator = useDelayedVisibility({
		visible: userSkillsStore.loadingMore,
	})
	const isTeamSharedTab = !isCreatedByMeTab && !isFromSkillsLibraryTab

	const handleEdit = useCallback(
		(code: string) => {
			navigate({ name: RouteName.SkillEdit, params: { code } })
		},
		[navigate],
	)

	const handleOpenDetail = useCallback((skill: UserSkillView) => {
		setSelectedSkill(skill)
	}, [])

	const handleDeleteCreatedSkill = useCallback(
		(id: string) => {
			void userSkillsStore.deleteCreatedSkill(id)
		},
		[userSkillsStore],
	)

	const handleRemoveInstalledSkill = useCallback(
		(id: string) => {
			void userSkillsStore.removeInstalledSkill(id)
		},
		[userSkillsStore],
	)

	const createSkillMenuItems = useSkillCreateMenuItems({
		createViaChatTestId: "my-skills-create-via-chat",
		importSkillTestId: "my-skills-import-skill",
	})

	const handleImportSuccess = useCallback(() => {
		if (!isCreatedByMeTab) {
			setCreatedByMeTab()
			return
		}

		void userSkillsStore.fetchSkills({ page: 1 }, currentScope)
	}, [currentScope, isCreatedByMeTab, setCreatedByMeTab, userSkillsStore])
	const displayedSkills = userSkillsStore.list

	const handleCardOpen = useCallback(
		(skill: UserSkillView) => {
			if (
				isCreatedByMeTab ||
				(isTeamSharedTab && resolveTeamSharedSkillPermissions(skill.userRole).canEdit)
			) {
				handleEdit(skill.skillCode)
				return
			}

			handleOpenDetail(skill)
		},
		[handleEdit, handleOpenDetail, isCreatedByMeTab, isTeamSharedTab],
	)

	return (
		<div
			className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xs"
			data-testid="my-skills-page"
		>
			<SkillDetailDialog
				open={selectedSkill != null}
				onOpenChange={(nextOpen) => {
					if (nextOpen) return
					setSelectedSkill(null)
				}}
				skillCode={selectedSkill?.skillCode ?? null}
				detailSource="user"
				skillSummary={selectedSkill}
			/>
			<ImportSkillPublishPromptDialog
				skillCode={publishPromptSkillCode}
				onOpenChange={(open) => {
					if (open) return
					setPublishPromptSkillCode(null)
				}}
			/>
			{/* Top header bar */}
			<PageTopBar data-testid="my-skills-top-bar" backButtonTestId="my-skills-back-button" />

			{/* Main scrollable section */}
			<ScrollArea className="min-h-0 flex-1" viewportRef={scrollViewportRef}>
				<div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-7">
					{/* Title + action buttons */}
					<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
						<div className="flex min-w-0 flex-1 flex-col gap-2">
							<h1 className="break-words text-2xl leading-tight text-foreground sm:text-3xl lg:text-4xl">
								{t("mySkills.title")}
							</h1>
							<p className="max-w-2xl break-words text-sm text-muted-foreground">
								{t("mySkills.subtitle")}
							</p>
						</div>
						<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
							{canCreateSkill ? (
								<SkillActionDropdown
									createMenuItems={createSkillMenuItems}
									onImportSuccess={handleImportSuccess}
									promptPublishAfterImport
									placement="bottomRight"
									overlayClassName="w-80"
								>
									<span>
										<Button
											className="h-9 flex-1 gap-2 shadow-xs sm:flex-none"
											data-testid="my-skills-create-button"
										>
											<CirclePlus className="h-4 w-4" />
											{t("skillsLibrary.createSkill")}
											<ChevronDown className="h-4 w-4" />
										</Button>
									</span>
								</SkillActionDropdown>
							) : null}
						</div>
					</div>

					<Tabs
						value={activeTab}
						onValueChange={handleTabValueChange}
						className="gap-0"
						data-testid="my-skills-tabs"
					>
						<TabsList
							className={`grid h-9 w-full max-w-[600px] ${
								tabCount === 2 ? "grid-cols-2" : "grid-cols-3"
							}`}
							data-testid="my-skills-tabs-list"
						>
							{tabItems.map((tabItem) => (
								<TabsTrigger
									key={tabItem.value}
									value={tabItem.value}
									data-testid={tabItem.testId}
								>
									{t(tabItem.labelKey)}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>

					{/* Skill card grid */}
					{userSkillsStore.loading && displayedSkills.length === 0 ? (
						<div
							className="flex items-center justify-center py-8"
							data-testid="my-skills-loading"
						>
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					) : userSkillsStore.isEmpty ? (
						<div
							className="flex items-center justify-center py-8 text-sm text-muted-foreground"
							data-testid="my-skills-empty"
						>
							{t("skillsLibrary.noMoreData")}
						</div>
					) : (
						<div
							className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
							data-testid="my-skill-card-grid"
						>
							{displayedSkills.map((skill) => {
								const teamPermissions = resolveTeamSharedSkillPermissions(
									skill.userRole,
								)

								return (
									<MySkillCard
										key={skill.id}
										skill={skill}
										cardVariant={
											isCreatedByMeTab
												? "created"
												: isFromSkillsLibraryTab
													? "library"
													: "team"
										}
										onOpenDetail={handleCardOpen}
										onEdit={
											isCreatedByMeTab ||
											(isTeamSharedTab && teamPermissions.canEdit)
												? handleEdit
												: undefined
										}
										onDelete={
											isCreatedByMeTab ||
											(isTeamSharedTab && teamPermissions.canDelete)
												? handleDeleteCreatedSkill
												: undefined
										}
										onRemove={
											isFromSkillsLibraryTab
												? handleRemoveInstalledSkill
												: undefined
										}
										canEdit={
											isCreatedByMeTab ||
											(isTeamSharedTab && teamPermissions.canEdit)
										}
										isInteractive
									/>
								)
							})}
						</div>
					)}

					<div
						ref={loadMoreSentinelRef}
						className="h-1 w-full"
						data-testid="my-skills-scroll-sentinel"
					/>

					{shouldShowLoadingMoreIndicator ? (
						<div
							className="flex items-center justify-center py-2"
							data-testid="my-skills-loading-more"
						>
							<Loader2 className="size-4 animate-spin text-muted-foreground" />
						</div>
					) : null}

					{!userSkillsStore.hasMore && userSkillsStore.list.length > 0 ? (
						<div
							className="flex items-center justify-center gap-1 py-2 opacity-30"
							data-testid="my-skills-no-more"
						>
							<Check className="size-4" />
							<span className="text-xs">{t("skillsLibrary.noMoreData")}</span>
						</div>
					) : null}
				</div>
			</ScrollArea>
		</div>
	)
}

export default observer(MySkillsPage)
