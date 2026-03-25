import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { CirclePlus, ChevronDown, Check, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { useLocation } from "react-router"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import PageTopBar from "@/pages/superMagic/components/PageTopBar"
import ImportSkillPublishPromptDialog from "@/pages/superMagic/components/ImportSkillPublishPromptDialog"
import SkillActionDropdown from "@/pages/superMagic/components/SkillActionDropdown"
import { useSkillCreateMenuItems } from "@/pages/superMagic/hooks/useSkillCreateMenuItems"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { RoutePath } from "@/constants/routes"
import { configStore } from "@/models/config"
import { defaultClusterCode } from "@/routes/helpers"
import { fillRoute } from "@/routes/history/helpers"
import { useAutoLoadMoreSentinel } from "@/pages/superMagic/hooks/useAutoLoadMoreSentinel"
import { useDelayedVisibility } from "@/pages/superMagic/hooks/useDelayedVisibility"
import MySkillCard from "./components/MySkillCard"
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

function MySkillsPage() {
	const { t } = useTranslation("crew/market")
	const userSkillsStore = useMemo(() => new UserSkillsStore(), [])
	const navigate = useNavigate()
	const location = useLocation()
	const clusterCode = configStore.cluster.clusterCode || defaultClusterCode
	const scrollViewportRef = useRef<HTMLDivElement | null>(null)
	const [activeTab, setActiveTab] = useState<MySkillsTabValue>(
		() => getMySkillsRequestedTab(location.search) ?? MY_SKILLS_TAB_VALUES.createdByMe,
	)
	const [publishPromptSkillCode, setPublishPromptSkillCode] = useState<string | null>(null)
	const currentScope = MY_SKILLS_TAB_SCOPE_MAP[activeTab]
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
	const shouldShowLoadingMoreIndicator = useDelayedVisibility({
		visible: userSkillsStore.loadingMore,
	})

	const handleOpenSkill = useCallback(
		(code: string) => {
			navigate({ name: RouteName.SkillEdit, params: { code } })
		},
		[navigate],
	)

	const handleEdit = handleOpenSkill

	const getSkillEditHref = useCallback(
		(skillCode: string) =>
			fillRoute(`/:clusterCode${RoutePath.SkillEdit}`, {
				clusterCode,
				code: skillCode,
			}) || "#",
		[clusterCode],
	)

	const handleSkillCardNavigate = useCallback(
		(skillCode: string, event: React.MouseEvent<HTMLElement>) => {
			if (
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey
			) {
				return
			}
			event.preventDefault()
			navigate({ name: RouteName.SkillEdit, params: { code: skillCode } })
		},
		[navigate],
	)

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
		if (activeTab !== MY_SKILLS_TAB_VALUES.createdByMe) {
			setActiveTab(MY_SKILLS_TAB_VALUES.createdByMe)
			return
		}

		void userSkillsStore.fetchSkills(
			{ page: 1 },
			MY_SKILLS_TAB_SCOPE_MAP[MY_SKILLS_TAB_VALUES.createdByMe],
		)
	}, [activeTab, userSkillsStore])

	const tabItems = useMemo<MySkillsTabItem[]>(
		() => [
			{
				value: MY_SKILLS_TAB_VALUES.createdByMe,
				labelKey: "mySkills.tabs.createdByMe",
				testId: "my-skills-tab-created-by-me",
			},
			{
				value: MY_SKILLS_TAB_VALUES.sharedByTeam,
				labelKey: "mySkills.tabs.sharedByTeam",
				testId: "my-skills-tab-shared-by-team",
			},
			{
				value: MY_SKILLS_TAB_VALUES.fromSkillsLibrary,
				labelKey: "mySkills.tabs.fromSkillsLibrary",
				testId: "my-skills-tab-from-skills-library",
			},
		],
		[],
	)

	const isCreatedByMeTab = activeTab === MY_SKILLS_TAB_VALUES.createdByMe
	const isFromSkillsLibraryTab = activeTab === MY_SKILLS_TAB_VALUES.fromSkillsLibrary
	const displayedSkills = userSkillsStore.list

	return (
		<div
			className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xs"
			data-testid="my-skills-page"
		>
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
						</div>
					</div>

					<Tabs
						value={activeTab}
						onValueChange={(value) => setActiveTab(value as MySkillsTabValue)}
						className="gap-0"
						data-testid="my-skills-tabs"
					>
						<TabsList
							className="grid h-9 w-full max-w-[600px] grid-cols-3"
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
							{displayedSkills.map((skill) => (
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
									href={
										isCreatedByMeTab
											? getSkillEditHref(skill.skillCode)
											: undefined
									}
									onNavigate={
										isCreatedByMeTab
											? (event) =>
													handleSkillCardNavigate(skill.skillCode, event)
											: undefined
									}
									onEdit={handleEdit}
									onDelete={
										isCreatedByMeTab ? handleDeleteCreatedSkill : undefined
									}
									onRemove={
										isFromSkillsLibraryTab
											? handleRemoveInstalledSkill
											: undefined
									}
									canEdit={isCreatedByMeTab}
									isInteractive={isCreatedByMeTab}
								/>
							))}
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
