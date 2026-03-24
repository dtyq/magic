import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, CirclePlus, Loader2 } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import ImportSkillPublishPromptDialog from "@/pages/superMagic/components/ImportSkillPublishPromptDialog"
import PcOnlyNoticeDialog from "@/pages/superMagic/components/PcOnlyNoticeDialog"
import ActionsPopupComponent from "@/pages/superMagicMobile/components/ActionsPopup"
import type { ActionsPopup } from "@/pages/superMagicMobile/components/ActionsPopup/types"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { RoutePath } from "@/constants/routes"
import { configStore } from "@/models/config"
import { defaultClusterCode } from "@/routes/helpers"
import { fillRoute } from "@/routes/history/helpers"
import { ViewTransitionPresets } from "@/types/viewTransition"
import type { UserSkillView } from "@/services/skills/SkillsService"
import { useAutoLoadMoreSentinel } from "@/pages/superMagic/hooks/useAutoLoadMoreSentinel"
import { useDelayedVisibility } from "@/pages/superMagic/hooks/useDelayedVisibility"
import MySkillCardMobile from "./components/MySkillCardMobile"
import { UserSkillsStore } from "./stores/user-skills"
import {
	buildMySkillsQuery,
	getMySkillsPublishPromptSkillCode,
	getMySkillsRequestedTab,
	MY_SKILLS_TAB_SCOPE_MAP,
	MY_SKILLS_TAB_VALUES,
	type MySkillsTabValue,
} from "./route-state"

interface MySkillsTabItem {
	value: MySkillsTabValue
	labelKey: string
	testId: string
}

function MySkillsPageMobile() {
	const { t } = useTranslation("crew/market")
	const navigate = useNavigate()
	const location = useLocation()
	const clusterCode = configStore.cluster.clusterCode || defaultClusterCode
	const storeRef = useRef(new UserSkillsStore())
	const userSkillsStore = storeRef.current
	const scrollViewportRef = useRef<HTMLDivElement | null>(null)

	const [activeTab, setActiveTab] = useState<MySkillsTabValue>(
		() => getMySkillsRequestedTab(location.search) ?? MY_SKILLS_TAB_VALUES.createdByMe,
	)
	const [publishPromptSkillCode, setPublishPromptSkillCode] = useState<string | null>(null)
	const [isPcOnlyDialogOpen, setIsPcOnlyDialogOpen] = useState(false)
	const [selectedSkill, setSelectedSkill] = useState<UserSkillView | null>(null)

	const currentScope = MY_SKILLS_TAB_SCOPE_MAP[activeTab]
	const isCreatedByMeTab = activeTab === MY_SKILLS_TAB_VALUES.createdByMe
	const isFromSkillsLibraryTab = activeTab === MY_SKILLS_TAB_VALUES.fromSkillsLibrary
	const handleAutoLoadMore = useCallback(() => {
		void userSkillsStore.loadMore()
	}, [userSkillsStore])
	const loadMoreSentinelRef = useAutoLoadMoreSentinel({
		rootRef: scrollViewportRef,
		disabled:
			userSkillsStore.loading || userSkillsStore.loadingMore || !userSkillsStore.hasMore,
		onLoadMore: handleAutoLoadMore,
	})
	const shouldShowLoadingMoreIndicator = useDelayedVisibility({
		visible: userSkillsStore.loadingMore,
	})

	useEffect(() => {
		return () => userSkillsStore.reset()
	}, [userSkillsStore])

	useEffect(() => {
		const requestedTab = getMySkillsRequestedTab(location.search)
		const requestedPublishPromptSkillCode = getMySkillsPublishPromptSkillCode(location.search)
		if (!requestedTab && !requestedPublishPromptSkillCode) return

		if (requestedTab) setActiveTab(requestedTab)
		if (requestedPublishPromptSkillCode) {
			setPublishPromptSkillCode(requestedPublishPromptSkillCode)
		}
		navigate({
			name: RouteName.MySkills,
			query: buildMySkillsQuery({
				search: location.search,
				tab: null,
				publishSkillCode: null,
			}),
			replace: true,
		})
	}, [location.search, navigate])

	useEffect(() => {
		void userSkillsStore.fetchSkills({ page: 1 }, currentScope)
	}, [currentScope, userSkillsStore])

	const { confirm, dialog } = useConfirmDialog()

	const tabItems = useMemo<MySkillsTabItem[]>(
		() => [
			{
				value: MY_SKILLS_TAB_VALUES.createdByMe,
				labelKey: "mySkills.tabs.createdByMe",
				testId: "my-skills-mobile-tab-created-by-me",
			},
			{
				value: MY_SKILLS_TAB_VALUES.sharedByTeam,
				labelKey: "mySkills.tabs.sharedByTeam",
				testId: "my-skills-mobile-tab-shared-by-team",
			},
			{
				value: MY_SKILLS_TAB_VALUES.fromSkillsLibrary,
				labelKey: "mySkills.tabs.fromSkillsLibrary",
				testId: "my-skills-mobile-tab-from-skills-library",
			},
		],
		[],
	)

	const getSkillEditHref = useCallback(
		(skillCode: string) =>
			fillRoute(`/:clusterCode${RoutePath.SkillEdit}`, {
				clusterCode,
				code: skillCode,
			}) || "#",
		[clusterCode],
	)

	const handleBack = useCallback(() => {
		navigate({
			delta: -1,
			viewTransition: ViewTransitionPresets.slideRight,
		})
	}, [navigate])

	const showPcOnlyNotice = useCallback(() => {
		setIsPcOnlyDialogOpen(true)
	}, [])

	const handlePcOnlyEdit = useCallback(
		(event?: React.MouseEvent<HTMLAnchorElement>) => {
			event?.preventDefault()
			event?.stopPropagation()
			showPcOnlyNotice()
		},
		[showPcOnlyNotice],
	)

	const handleDeleteCreatedSkill = useCallback(
		(skill: UserSkillView) => {
			setSelectedSkill(null)
			const displayName = skill.name?.trim() || t("mySkills.untitledSkill")
			confirm({
				title: t("mySkills.deleteConfirm.title", { name: displayName }),
				description: t("mySkills.deleteConfirm.description"),
				confirmText: t("mySkills.deleteConfirm.confirm"),
				variant: "destructive",
				destructivePresentation: "soft",
				dialogSize: "sm",
				onConfirm: () => userSkillsStore.deleteCreatedSkill(skill.id),
			})
		},
		[confirm, t, userSkillsStore],
	)

	const handleRemoveInstalledSkill = useCallback(
		(skill: UserSkillView) => {
			setSelectedSkill(null)
			const displayName = skill.name?.trim() || t("mySkills.untitledSkill")
			confirm({
				title: t("mySkills.deleteConfirm.title", { name: displayName }),
				description: t("mySkills.deleteConfirm.description"),
				confirmText: t("mySkills.deleteConfirm.confirm"),
				variant: "destructive",
				destructivePresentation: "soft",
				dialogSize: "sm",
				onConfirm: () => userSkillsStore.removeInstalledSkill(skill.id),
			})
		},
		[confirm, t, userSkillsStore],
	)

	function handleMenuOpen(skill: UserSkillView) {
		setSelectedSkill(skill)
	}

	const handleEditAction = useCallback(() => {
		setSelectedSkill(null)
		showPcOnlyNotice()
	}, [showPcOnlyNotice])

	const mobileActions = useMemo<ActionsPopup.ActionButtonConfig[]>(() => {
		if (!selectedSkill) return []

		const actions: ActionsPopup.ActionButtonConfig[] = []

		if (isCreatedByMeTab) {
			actions.push({
				key: "edit",
				label: t("mySkills.edit"),
				onClick: handleEditAction,
				"data-testid": "my-skills-mobile-action-edit",
			})
		}

		actions.push({
			key: "delete",
			label: t(isCreatedByMeTab ? "mySkills.delete" : "mySkills.remove"),
			variant: "danger",
			onClick: () => {
				if (isCreatedByMeTab) {
					handleDeleteCreatedSkill(selectedSkill)
					return
				}

				handleRemoveInstalledSkill(selectedSkill)
			},
			"data-testid": "my-skills-mobile-action-delete",
		})

		return actions
	}, [
		handleDeleteCreatedSkill,
		handleEditAction,
		handleRemoveInstalledSkill,
		isCreatedByMeTab,
		selectedSkill,
		t,
	])

	const displayedSkills = userSkillsStore.list

	return (
		<>
			<ImportSkillPublishPromptDialog
				skillCode={publishPromptSkillCode}
				onOpenChange={(open) => {
					if (open) return
					setPublishPromptSkillCode(null)
				}}
			/>
			{dialog}
			<PcOnlyNoticeDialog
				open={isPcOnlyDialogOpen}
				onOpenChange={setIsPcOnlyDialogOpen}
				title={t("mySkills.pcOnlyNotice.title")}
				description={t("mySkills.pcOnlyNotice.description")}
				confirmText={t("mySkills.pcOnlyNotice.confirm")}
				testIdPrefix="my-skills-mobile-pc-only"
			/>

			<ActionsPopupComponent
				visible={selectedSkill != null}
				title={t("mySkills.moreActionsAria")}
				actions={mobileActions}
				onClose={() => setSelectedSkill(null)}
				cancelText={t("editSkill.buttons.cancel")}
			/>

			<div
				className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border border-t-0 border-border bg-background shadow-xs"
				data-testid="my-skills-page-mobile"
			>
				<header
					data-testid="my-skills-mobile-top-bar"
					className="relative flex h-12 shrink-0 items-center rounded-b-xl bg-background px-2.5 shadow-xs"
				>
					<Button
						variant="ghost"
						size="icon"
						className="z-10 size-8 shrink-0 rounded-lg"
						onClick={handleBack}
						aria-label={t("back")}
						data-testid="my-skills-mobile-back"
					>
						<ChevronLeft className="size-6" aria-hidden />
					</Button>
					<h1 className="pointer-events-none absolute inset-0 flex items-center justify-center truncate px-24 text-center text-base font-medium leading-6 text-foreground">
						{t("mySkills.title")}
					</h1>
					<div className="z-10 ml-auto flex shrink-0">
						{isCreatedByMeTab ? (
							<Button
								variant="ghost"
								className="h-8 gap-1 rounded-md px-2 text-xs font-medium text-foreground"
								onClick={showPcOnlyNotice}
								data-testid="my-skills-mobile-create-button"
							>
								<CirclePlus className="size-4 shrink-0" aria-hidden />
								{t("skillsLibrary.createSkill")}
							</Button>
						) : null}
					</div>
				</header>

				<ScrollArea
					className="min-h-0 flex-1 [&_[data-slot='scroll-area-viewport']>div]:!block"
					viewportRef={scrollViewportRef}
				>
					<div className="flex min-w-0 flex-col gap-2.5 px-2 pb-8 pt-2">
						<Tabs
							value={activeTab}
							onValueChange={(value) => setActiveTab(value as MySkillsTabValue)}
							className="gap-0"
							data-testid="my-skills-mobile-tabs"
						>
							<TabsList
								className="grid h-9 w-full max-w-[340px] grid-cols-3"
								data-testid="my-skills-mobile-tabs-list"
							>
								{tabItems.map((tabItem) => (
									<TabsTrigger
										key={tabItem.value}
										value={tabItem.value}
										className="px-2 text-xs"
										data-testid={tabItem.testId}
									>
										{t(tabItem.labelKey)}
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>

						{userSkillsStore.loading && displayedSkills.length === 0 ? (
							<div
								className="flex items-center justify-center py-16"
								data-testid="my-skills-mobile-loading"
							>
								<Loader2 className="size-6 animate-spin text-muted-foreground" />
							</div>
						) : null}

						{userSkillsStore.isEmpty ? (
							<div
								className="flex flex-col items-center justify-center gap-3 py-16 text-center"
								data-testid="my-skills-mobile-empty"
							>
								<p className="text-sm text-muted-foreground">
									{t("skillsLibrary.noMoreData")}
								</p>
							</div>
						) : null}

						{!userSkillsStore.loading && displayedSkills.length > 0 ? (
							<div
								className="flex flex-col gap-2.5"
								data-testid="my-skills-mobile-card-list"
							>
								{displayedSkills.map((skill) => (
									<MySkillCardMobile
										key={skill.id}
										skill={skill}
										cardVariant={
											isCreatedByMeTab
												? "created"
												: isFromSkillsLibraryTab
													? "library"
													: "team"
										}
										href={
											isCreatedByMeTab
												? getSkillEditHref(skill.skillCode)
												: undefined
										}
										onNavigate={isCreatedByMeTab ? handlePcOnlyEdit : undefined}
										onMoreClick={
											isCreatedByMeTab || isFromSkillsLibraryTab
												? handleMenuOpen
												: undefined
										}
									/>
								))}
							</div>
						) : null}

						<div
							ref={loadMoreSentinelRef}
							className="h-1 w-full"
							data-testid="my-skills-mobile-scroll-sentinel"
						/>

						{shouldShowLoadingMoreIndicator ? (
							<div
								className="flex items-center justify-center py-2"
								data-testid="my-skills-mobile-loading-more"
							>
								<Loader2 className="size-4 animate-spin text-muted-foreground" />
							</div>
						) : null}

						{!userSkillsStore.hasMore && userSkillsStore.list.length > 0 ? (
							<div
								className="flex items-center justify-center py-1.5 text-xs text-muted-foreground/60"
								data-testid="my-skills-mobile-no-more"
							>
								{t("skillsLibrary.noMoreData")}
							</div>
						) : null}
					</div>
				</ScrollArea>
			</div>
		</>
	)
}

export default observer(MySkillsPageMobile)
