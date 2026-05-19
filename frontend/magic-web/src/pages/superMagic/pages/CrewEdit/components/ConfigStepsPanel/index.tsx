import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import {
	ArrowLeft,
	CirclePlay,
	CloudUpload,
	Files,
	Loader2,
	MoreHorizontal,
	Pause,
	PenLine,
	Play,
	SlidersHorizontal,
	Trash2,
	Plus,
} from "lucide-react"
import { FUNCTION_PERMISSION_CODE } from "@/apis"
import { resolveCrewI18nText } from "@/apis/modules/crew"
import { Button } from "@/components/shadcn-ui/button"
import { Badge } from "@/components/shadcn-ui/badge"
import { Separator } from "@/components/shadcn-ui/separator"
import { MagicDropdown } from "@/components/base/MagicDropdown"
import magicToast from "@/components/base/MagicToaster/utils"
import { cn } from "@/lib/tiptap-utils"
import type { ImportSkillResponse } from "@/apis/modules/skills"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useKnowledgeListPolling } from "../StepDetailPanel/KnowledgeDetailView/hooks/useKnowledgeListPolling"
import {
	CREW_EDIT_STEP,
	CREW_SIDEBAR_TAB,
	CREW_SKILLS_TAB,
	isCrewSidebarTabEnabled,
	isCrewStepEnabled,
	type CrewEditStep,
} from "../../store"
import { useCrewEditStore } from "../../context"
import { useInstallImportedSkill } from "../../hooks/useInstallImportedSkill"
import { useCrewPublishGuard } from "../../hooks/useCrewPublishGuard"
import { useMemberDisplay } from "../../hooks/useMemberDisplay"
import SkillAddDropdown from "../SkillAddDropdown"
import EditCrewDialog from "./EditCrewDialog"
import CrewCollaboratorsEntry from "./CrewCollaboratorsEntry"
import { SidebarRow } from "./SidebarRow"
import { useBuiltinSkills } from "./BuiltinSkillsPanel"
import { RoleIcon } from "../common/RoleIcon"
import { resolveLocalText } from "../StepDetailPanel/PlaybookPanel/components/SceneEditPanel/utils"
import { SkillThumbnail } from "@/pages/superMagic/components/SkillThumbnail"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"
import type { Knowledge } from "@/types/knowledge"
import { shouldShowCrewKnowledgeBaseEntry } from "../../utils/knowledge-entry-visibility"
import CreateKnowledgeDialog from "../StepDetailPanel/KnowledgeDetailView/components/CreateKnowledgeDialog"
import KnowledgeCard from "../StepDetailPanel/KnowledgeDetailView/components/KnowledgeCard"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"
import { getSceneThemePreviewStyle } from "../common/sceneThemePreview"

interface ConfigStepsPanelProps {
	onBack: () => void
	filesContent: ReactNode
}

function SidebarExpandableItem({
	label,
	onClick,
	isActive = false,
	isExpanded = false,
	leading,
	trailing,
	testId,
	className,
	contentClassName,
	childrenClassName,
	children,
}: {
	label: string
	onClick: () => void
	isActive?: boolean
	isExpanded?: boolean
	leading?: ReactNode
	trailing?: ReactNode
	testId: string
	className?: string
	contentClassName?: string
	childrenClassName?: string
	children: ReactNode
}) {
	return (
		<div className={className} data-testid={`${testId}-section`}>
			<SidebarRow
				label={label}
				onClick={onClick}
				isActive={isActive}
				isExpanded={isExpanded}
				leading={leading}
				trailing={trailing}
				testId={testId}
			/>
			<div
				className={cn(
					"grid overflow-hidden transition-all duration-200 ease-out",
					isExpanded
						? "grid-rows-[minmax(0,1fr)] opacity-100"
						: "pointer-events-none grid-rows-[0fr] opacity-0",
					contentClassName,
				)}
				data-testid={`${testId}-content`}
			>
				<div
					className={cn(
						"min-h-0 overflow-hidden bg-muted/20 transition-[transform,opacity] duration-200 ease-out",
						isExpanded ? "translate-y-0" : "-translate-y-1",
					)}
				>
					<div
						className={cn(
							"duration-200",
							isExpanded && "animate-in fade-in slide-in-from-top-1",
							childrenClassName,
						)}
					>
						{children}
					</div>
				</div>
			</div>
		</div>
	)
}

const SidebarKnowledgeList = observer(function SidebarKnowledgeList({
	onEditKnowledge,
}: {
	onEditKnowledge: (kb: Knowledge.KnowledgeItem) => void
}) {
	const { t } = useTranslation("crew/create")
	const [searchParams] = useSearchParams()
	const activeKnowledgeCode = searchParams.get("code")
	const { knowledge, crewCode, layout } = useCrewEditStore()
	const navigate = useNavigate()
	const [enablePolling, setEnablePolling] = useState(false)

	useEffect(() => {
		void knowledge.fetchKnowledgeList(true)
	}, [knowledge])

	// 订阅 pubsub 事件以触发 polling
	useEffect(() => {
		const handleTriggerPolling = () => {
			setEnablePolling(true)
		}

		pubsub.subscribe(PubSubEvents.Trigger_Knowledge_List_Polling, handleTriggerPolling)

		return () => {
			pubsub.unsubscribe(PubSubEvents.Trigger_Knowledge_List_Polling, handleTriggerPolling)
		}
	}, [])

	// 知识库列表轮询
	// useKnowledgeListPolling({
	// 	enabled: enablePolling && knowledge.knowledgeList.length > 0,
	// 	knowledgeList: knowledge.knowledgeList.map((kb) => ({
	// 		code: kb.code,
	// 		expected_count: kb.expected_count || 0,
	// 		completed_count: kb.completed_count || 0,
	// 	})),
	// 	onFetchKnowledgeList: async () => {
	// 		await knowledge.fetchKnowledgeList(false, true) // silent fetch
	// 	},
	// })

	// 监听知识库列表变化和 URL 参数，确保面板状态正确
	useEffect(() => {
		if (!activeKnowledgeCode || knowledge.knowledgeList.length === 0) return

		// 确保 accordion 展开
		if (layout.activeAccordionStep !== CREW_EDIT_STEP.KnowledgeBase) {
			layout.expandKnowledgeBaseSection()
		}

		// 确保 activeDetailKey 被设置，这样 detail panel 才会显示
		if (layout.activeDetailKey !== CREW_EDIT_STEP.KnowledgeBase) {
			layout.setActiveStep(CREW_EDIT_STEP.KnowledgeBase)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeKnowledgeCode, knowledge.knowledgeList.length])

	const handleRefresh = useCallback(async () => {
		await knowledge.fetchKnowledgeList(true, true)

		// 刷新后检查当前选中的知识库是否还存在
		if (activeKnowledgeCode && crewCode) {
			const stillExists = knowledge.knowledgeList.some(
				(kb) => kb.code === activeKnowledgeCode,
			)

			if (!stillExists) {
				// 当前知识库被删除了，切换到第一个知识库（如果有的话）
				if (knowledge.knowledgeList.length > 0) {
					navigate({
						name: RouteName.CrewEdit,
						params: { id: crewCode },
						query: {
							panel: CREW_EDIT_STEP.KnowledgeBase,
							code: knowledge.knowledgeList[0].code,
						},
					})
				} else {
					// 没有知识库了，清除 code 参数
					navigate({
						name: RouteName.CrewEdit,
						params: { id: crewCode },
					})
				}
			}
		}
	}, [activeKnowledgeCode, crewCode, knowledge, navigate])

	if (!crewCode) {
		return (
			<p
				className="px-3 py-4 text-xs text-muted-foreground"
				data-testid="crew-knowledge-no-crew"
			>
				{t("knowledgeBase.emptyTitle")}
			</p>
		)
	}

	if (!knowledge.initialLoaded && knowledge.loading) {
		return (
			<div
				className="flex items-center justify-center gap-2 px-3 py-5 text-xs text-muted-foreground"
				data-testid="crew-knowledge-sidebar-loading"
			>
				<Loader2 className="size-4 animate-spin" />
				{t("knowledgeDetail.loading")}
			</div>
		)
	}

	if (knowledge.knowledgeList.length === 0 && !knowledge.loading) {
		return (
			<p
				className="px-3 py-4 text-xs text-muted-foreground"
				data-testid="crew-knowledge-sidebar-empty"
			>
				{t("knowledgeBase.emptyTitle")}
			</p>
		)
	}

	return (
		<div className="flex flex-col" data-testid="crew-knowledge-sidebar-list">
			{knowledge.knowledgeList.map((kb, index) => (
				<div key={kb.code} className="px-2">
					{index > 0 && <Separator />}
					<div
						className={cn(
							"rounded-md transition-colors duration-200 ease-out",
							activeKnowledgeCode === kb.code && "bg-accent/35",
						)}
					>
						<KnowledgeCard
							variant="sidebar"
							knowledge={kb}
							crewCode={crewCode}
							onEdit={onEditKnowledge}
							onRefresh={handleRefresh}
							index={index}
						/>
					</div>
				</div>
			))}
			{knowledge.hasMore ? (
				<div className="px-3 py-2">
					<Button
						variant="ghost"
						size="sm"
						className="h-8 w-full text-xs text-muted-foreground"
						onClick={() => void knowledge.loadMore()}
						disabled={knowledge.loading}
						data-testid="crew-knowledge-sidebar-load-more"
					>
						{knowledge.loading ? (
							<>
								<Loader2 className="mr-1 size-3.5 animate-spin" />
								{t("knowledgeDetail.loading")}
							</>
						) : (
							t("common.loadMore")
						)}
					</Button>
				</div>
			) : null}
		</div>
	)
})

const SidebarSkillList = observer(function SidebarSkillList() {
	const { t, i18n } = useTranslation("crew/create")
	const { skills } = useCrewEditStore()
	const [busySkillCodes, setBusySkillCodes] = useState<Set<string>>(new Set())

	const setSkillBusy = useCallback((skillCode: string, isBusy: boolean) => {
		setBusySkillCodes((prev) => {
			const next = new Set(prev)
			if (isBusy) next.add(skillCode)
			else next.delete(skillCode)
			return next
		})
	}, [])

	const handleUninstallSkill = useCallback(
		async (skillCode: string) => {
			if (busySkillCodes.has(skillCode)) return

			setSkillBusy(skillCode, true)
			skills.removeSkill(skillCode)

			try {
				await skills.removeSkillFromAgent(skillCode)
				try {
					await skills.refreshSkills()
				} catch {
					// Keep optimistic UI when sync fails transiently.
				}
			} catch (error) {
				try {
					await skills.refreshSkills()
				} catch {
					// Ignore secondary refresh failures after rollback attempt.
				}

				const message = error instanceof Error ? error.message : undefined
				if (message) magicToast.error(message)
			} finally {
				setSkillBusy(skillCode, false)
			}
		},
		[busySkillCodes, setSkillBusy, skills],
	)

	if (skills.skills.length === 0) {
		return (
			<p className="px-3 py-4 text-xs text-muted-foreground" data-testid="crew-skills-empty">
				{t("skills.emptyTitle")}
			</p>
		)
	}

	return (
		<div className="flex flex-col" data-testid="crew-skills-list">
			{skills.skills.map((skill, index) => {
				const isBusy = busySkillCodes.has(skill.skill_code)
				const menuItems = [
					{
						key: "uninstall",
						icon: isBusy ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Trash2 className="h-4 w-4" />
						),
						label: t("skills.uninstall"),
						danger: true,
						disabled: isBusy,
						onClick: () => void handleUninstallSkill(skill.skill_code),
						"data-testid": `crew-skill-menu-uninstall-${skill.skill_code}`,
					},
				]

				return (
					<div key={skill.skill_code}>
						{index > 0 && <Separator />}
						<MagicDropdown
							menu={{ items: menuItems }}
							trigger={["contextMenu"]}
							rootClassName="block"
						>
							<div
								className="group flex items-start gap-2.5 px-3 py-3 transition-colors duration-200 ease-out hover:bg-accent/20"
								data-testid={`crew-skill-item-row-${skill.skill_code}`}
							>
								<SkillThumbnail
									src={skill.logo}
									alt={resolveCrewI18nText(skill.name_i18n, i18n.language)}
									resetKey={skill.skill_code}
									iconSize={40}
									className="size-10 transition-transform duration-200 ease-out group-hover:scale-[1.02]"
									imgClassName="transition-transform duration-200 ease-out"
									data-testid={`crew-skill-item-thumbnail-${skill.skill_code}`}
								/>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium text-foreground">
										{resolveCrewI18nText(skill.name_i18n, i18n.language)}
									</p>
									<p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">
										{resolveCrewI18nText(
											skill.description_i18n,
											i18n.language,
										) || t("skills.emptyTitle")}
									</p>
								</div>
								<MagicDropdown menu={{ items: menuItems }} trigger={["click"]}>
									<span>
										<Button
											variant="ghost"
											size="icon"
											className="size-7 shrink-0 rounded-md text-muted-foreground transition-colors duration-200 ease-out hover:bg-accent/30 hover:text-foreground"
											data-testid={`crew-skill-item-more-${skill.skill_code}`}
										>
											{isBusy ? (
												<Loader2 className="size-4 animate-spin" />
											) : (
												<MoreHorizontal className="size-4" />
											)}
										</Button>
									</span>
								</MagicDropdown>
							</div>
						</MagicDropdown>
					</div>
				)
			})}
		</div>
	)
})

const SidebarPlaybookList = observer(function SidebarPlaybookList() {
	const { t, i18n } = useTranslation("crew/create")
	const { layout, playbook } = useCrewEditStore()
	const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
	const activeResolvedPlaybookId =
		playbook.playbookIdMap.get(layout.activePlaybookId ?? "") ?? layout.activePlaybookId

	useEffect(() => {
		if (!activeResolvedPlaybookId) return
		itemRefs.current[activeResolvedPlaybookId]?.scrollIntoView({
			block: "nearest",
			behavior: "smooth",
		})
	}, [activeResolvedPlaybookId])

	function handleOpenScene(sceneId: string) {
		layout.openPlaybook(sceneId)
	}

	function handleToggleScene(sceneId: string) {
		void playbook.toggleSceneEnabled(sceneId)
	}

	async function handleDeleteScene(sceneId: string) {
		const shouldCloseEditor =
			layout.activeDetailKey === CREW_EDIT_STEP.Playbook &&
			activeResolvedPlaybookId === sceneId

		await playbook.deleteScene(sceneId)

		if (!shouldCloseEditor) return

		const hasDeletedSceneBeenRestored = playbook.scenes.some((scene) => {
			const resolvedSceneId = playbook.playbookIdMap.get(scene.id) ?? scene.id
			return resolvedSceneId === sceneId
		})
		if (hasDeletedSceneBeenRestored) return

		layout.closePlaybookEditor()
	}

	if (playbook.scenesLoading) {
		return (
			<div
				className="flex items-center justify-center gap-2 px-3 py-5 text-xs text-muted-foreground"
				data-testid="crew-playbook-loading"
			>
				<Loader2 className="size-4 animate-spin" />
				{t("playbook.loading")}
			</div>
		)
	}

	if (playbook.scenesError) {
		return (
			<p className="px-3 py-4 text-xs text-destructive" data-testid="crew-playbook-error">
				{playbook.scenesError}
			</p>
		)
	}

	if (playbook.scenes.length === 0) {
		return (
			<p
				className="px-3 py-4 text-xs text-muted-foreground"
				data-testid="crew-playbook-empty"
			>
				{t("playbook.noData")}
			</p>
		)
	}

	return (
		<div className="flex flex-col" data-testid="crew-playbook-list">
			{playbook.scenes.map((scene, index) => {
				const sceneThemeStyle = getSceneThemePreviewStyle(scene.theme_color)

				return (
					<div key={scene.id}>
						{index > 0 && <Separator />}
						<div
							ref={(node) => {
								itemRefs.current[scene.id] = node
							}}
							className={cn(
								"group flex items-start gap-2.5 px-3 py-3 transition-colors duration-200 ease-out hover:bg-accent/20",
								activeResolvedPlaybookId === scene.id && "bg-accent/35",
							)}
							data-testid={`crew-playbook-item-row-${scene.id}`}
						>
							<button
								type="button"
								className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
								onClick={() => handleOpenScene(scene.id)}
								data-testid={`crew-playbook-item-${scene.id}`}
							>
								<div
									className="flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent bg-sidebar-accent transition-transform duration-200 ease-out group-hover:scale-[1.02]"
									style={sceneThemeStyle}
								>
									<LucideLazyIcon
										icon={scene.icon}
										size={16}
										className={
											sceneThemeStyle
												? "text-current"
												: "text-muted-foreground"
										}
									/>
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium text-foreground">
										{resolveLocalText(scene.name, i18n.language) ||
											t("playbook.untitled")}
									</p>
									<p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">
										{resolveLocalText(scene.description, i18n.language) ||
											t("playbook.untitledDescription")}
									</p>
								</div>
							</button>
							<MagicDropdown
								placement="bottomRight"
								menu={{
									items: [
										{
											key: "edit",
											icon: <PenLine className="h-4 w-4" />,
											label: t("playbook.actions.edit"),
											onClick: () => handleOpenScene(scene.id),
											"data-testid": `crew-playbook-menu-edit-${scene.id}`,
										},
										{
											key: scene.enabled ? "disable" : "enable",
											icon: scene.enabled ? (
												<Pause className="h-4 w-4" />
											) : (
												<Play className="h-4 w-4" />
											),
											label: scene.enabled
												? t("playbook.actions.disable")
												: t("playbook.actions.enable"),
											onClick: () => handleToggleScene(scene.id),
											"data-testid": `crew-playbook-menu-toggle-${scene.id}`,
										},
										{ type: "divider" },
										{
											key: "delete",
											icon: <Trash2 className="h-4 w-4" />,
											label: t("playbook.actions.delete"),
											danger: true,
											onClick: () => void handleDeleteScene(scene.id),
											"data-testid": `crew-playbook-menu-delete-${scene.id}`,
										},
									],
								}}
							>
								<span>
									<Button
										variant="ghost"
										size="icon"
										className={cn(
											"size-7 shrink-0 rounded-md text-muted-foreground transition-colors duration-200 ease-out hover:bg-accent/30 hover:text-foreground",
											activeResolvedPlaybookId === scene.id &&
												"text-foreground",
										)}
										data-testid={`crew-playbook-item-more-${scene.id}`}
									>
										<MoreHorizontal className="size-4" />
									</Button>
								</span>
							</MagicDropdown>
						</div>
					</div>
				)
			})}
		</div>
	)
})

function SidebarSection({
	children,
	testId,
	className,
}: {
	children: ReactNode
	testId: string
	className?: string
}) {
	return (
		<div
			className={cn(
				"overflow-hidden rounded-lg border border-border bg-background",
				className,
			)}
			data-testid={testId}
		>
			{children}
		</div>
	)
}

function ConfigStepsPanel({ onBack, filesContent }: ConfigStepsPanelProps) {
	const store = useCrewEditStore()
	const { identity, skills, layout, playbook, conversation, initLoading, crewCode } = store
	const { t } = useTranslation("crew/create")
	const [isEditCrewDialogOpen, setIsEditCrewDialogOpen] = useState(false)
	const { isAllowed: canCreateAgent } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.AgentCreate,
	)
	const { isAllowed: canPublishAgentTeam } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.AgentPublish,
	)
	const canOpenAgentPublishPanel = canCreateAgent || canPublishAgentTeam
	const { avatarUrl } = useMemberDisplay({
		name_i18n: identity.name_i18n,
		role_i18n: identity.role_i18n,
		description_i18n: identity.description_i18n,
		icon: identity.icon,
		prompt: identity.prompt,
		skills: skills.skills,
	})
	const crewDisplayName = identity.name_i18n.default?.trim()
	const { skills: builtinSkills } = useBuiltinSkills()
	const installImportedSkill = useInstallImportedSkill()
	const {
		isPublishIdentityDialogOpen,
		isPublishingPending,
		handleOpenPublishing,
		handlePublishIdentityDialogOpenChange,
		handlePublishIdentitySaved,
	} = useCrewPublishGuard({
		identity,
		layout,
		isInitializing: crewCode == null || initLoading,
		projectId: conversation.selectedProject?.id,
		openPublishingStep: () => handleAdvancedStep(CREW_EDIT_STEP.Publishing),
	})
	const isCrewIdentityDialogOpen = isEditCrewDialogOpen || isPublishIdentityDialogOpen

	const handleImportSuccess = useCallback(
		async (result: ImportSkillResponse) => {
			await installImportedSkill(result, { openSkillsStep: true })
		},
		[installImportedSkill],
	)

	const [knowledgeDialogOpen, setKnowledgeDialogOpen] = useState(false)
	const [editingKnowledge, setEditingKnowledge] = useState<Knowledge.KnowledgeItem | null>(null)

	function handleAdvancedStep(step: CrewEditStep) {
		layout.setActiveSidebarTab(CREW_SIDEBAR_TAB.Advanced)
		layout.toggleStep(step)
	}

	function handleCrewIdentityDialogOpenChange(open: boolean) {
		if (isPublishIdentityDialogOpen) handlePublishIdentityDialogOpenChange(open)
		if (isEditCrewDialogOpen) setIsEditCrewDialogOpen(open)
	}

	async function handleCrewIdentitySaved() {
		if (isPublishIdentityDialogOpen) {
			await handlePublishIdentitySaved()
		}
	}

	const isSkillsExpanded = layout.activeAccordionStep === CREW_EDIT_STEP.Skills
	const isSkillsActive =
		layout.activeDetailKey === CREW_EDIT_STEP.Skills ||
		layout.activeDetailKey === CREW_EDIT_STEP.BuiltinSkills
	const isPlaybookExpanded = layout.activeAccordionStep === CREW_EDIT_STEP.Playbook
	const isPlaybookActive = layout.activeDetailKey === CREW_EDIT_STEP.Playbook
	const isKnowledgeExpanded = layout.activeAccordionStep === CREW_EDIT_STEP.KnowledgeBase
	const isKnowledgeActive = layout.activeDetailKey === CREW_EDIT_STEP.KnowledgeBase
	const shouldShowKnowledgeBaseEntry = shouldShowCrewKnowledgeBaseEntry(
		conversation.selectedProject?.user_role,
	)
	const shouldRenderKnowledgeBaseEntry =
		shouldShowKnowledgeBaseEntry && isCrewStepEnabled(CREW_EDIT_STEP.KnowledgeBase)

	function handleSkillsClick() {
		if (isSkillsExpanded) {
			layout.collapseSkillsSection()
			return
		}
		if (isSkillsActive) {
			layout.expandSkillsSection()
			return
		}

		layout.openSkillsPanel(CREW_SKILLS_TAB.MySkills)
	}

	function handlePlaybookClick() {
		if (isPlaybookExpanded) {
			layout.collapsePlaybookSection()
			return
		}
		if (isPlaybookActive) {
			layout.expandPlaybookSection()
			return
		}

		layout.openPlaybook()
	}

	function handleCreatePlaybook() {
		const scene = playbook.createScene()
		layout.openPlaybook(scene.id)
	}

	function handleKnowledgeClick() {
		if (isKnowledgeExpanded) {
			layout.collapseKnowledgeBaseSection()
			return
		}
		if (isKnowledgeActive) {
			layout.expandKnowledgeBaseSection()
			return
		}

		layout.openKnowledgeBaseList()
	}

	return (
		<div className="flex h-full flex-col gap-1" data-testid="crew-config-steps-panel">
			<div className="flex shrink-0 items-center gap-1">
				<Button
					variant="outline"
					size="icon"
					className="h-9 w-9 rounded-lg bg-background shadow-xs"
					onClick={onBack}
					data-testid="crew-edit-back-button"
				>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<button
					type="button"
					className="flex h-9 flex-1 items-center gap-1.5 overflow-hidden rounded-lg border border-border bg-background px-2 py-1.5 text-left shadow-xs transition-colors hover:bg-accent/30"
					onClick={() => setIsEditCrewDialogOpen(true)}
					data-testid="crew-name-input"
				>
					<div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-sm">
						{avatarUrl ? (
							<img src={avatarUrl} alt="" className="h-full w-full object-cover" />
						) : (
							<RoleIcon className="h-3.5 w-3.5" />
						)}
					</div>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium text-sidebar-foreground">
							{crewDisplayName || t("untitledCrew")}
						</p>
					</div>
				</button>
			</div>

			<SidebarSection
				testId="crew-sidebar-main-panel"
				className="flex min-h-0 flex-1 flex-col"
			>
				<div className="p-2">
					<Tabs
						value={layout.activeSidebarTab}
						onValueChange={(value) =>
							layout.setActiveSidebarTab(
								value as (typeof CREW_SIDEBAR_TAB)[keyof typeof CREW_SIDEBAR_TAB],
							)
						}
						className="w-full"
					>
						<TabsList className="grid h-9 w-full grid-cols-2">
							{isCrewSidebarTabEnabled(CREW_SIDEBAR_TAB.Files) && (
								<TabsTrigger
									value={CREW_SIDEBAR_TAB.Files}
									data-testid="crew-sidebar-tab-files"
								>
									<Files className="mr-1 h-4 w-4" />
									{t("sidebarTabs.files")}
								</TabsTrigger>
							)}
							{isCrewSidebarTabEnabled(CREW_SIDEBAR_TAB.Advanced) && (
								<TabsTrigger
									value={CREW_SIDEBAR_TAB.Advanced}
									data-testid="crew-sidebar-tab-advanced"
								>
									<SlidersHorizontal className="mr-1 h-4 w-4" />
									{t("sidebarTabs.advanced")}
								</TabsTrigger>
							)}
						</TabsList>
					</Tabs>
				</div>

				<div className="flex min-h-0 flex-1 flex-col">
					{layout.activeSidebarTab === CREW_SIDEBAR_TAB.Files ? (
						<div className="min-h-0 flex-1 overflow-hidden">{filesContent}</div>
					) : (
						<div
							className="flex min-h-0 flex-1 flex-col overflow-hidden"
							data-testid="crew-sidebar-advanced-list"
						>
							{isCrewStepEnabled(CREW_EDIT_STEP.Skills) && (
								<SidebarExpandableItem
									label={t("steps.skills")}
									onClick={handleSkillsClick}
									isActive={isSkillsActive}
									isExpanded={isSkillsExpanded}
									// leading={<SquareLibrary className="h-4 w-4" />}
									trailing={
										<>
											{isCrewStepEnabled(CREW_EDIT_STEP.BuiltinSkills) && (
												<Badge
													variant="secondary"
													className="h-5 cursor-pointer rounded-md px-2 text-[10px] font-medium hover:bg-secondary/80"
													onClick={(event) => {
														event.stopPropagation()
														layout.openBuiltinSkills()
													}}
													data-testid="crew-builtin-skills-badge"
												>
													{t("status.builtIn", {
														count: builtinSkills.length,
													})}
												</Badge>
											)}
											{canCreateAgent ? (
												<SkillAddDropdown
													onAddFromLibrary={() =>
														layout.openSkillsPanel(
															CREW_SKILLS_TAB.Library,
														)
													}
													onImportSuccess={handleImportSuccess}
													importSourceType="CREW_IMPORT"
												>
													<Button
														variant="ghost"
														size="icon"
														className="h-6 w-6"
														data-testid="crew-step-skills-add"
													>
														<Plus className="h-4 w-4" />
													</Button>
												</SkillAddDropdown>
											) : null}
										</>
									}
									testId="crew-step-skills"
									className={cn(
										"flex flex-col",
										isSkillsExpanded && "min-h-0 flex-1",
									)}
									contentClassName={cn("min-h-0", isSkillsExpanded && "flex-1")}
									childrenClassName={cn("min-h-0", isSkillsExpanded && "h-full")}
								>
									<ScrollArea
										className="h-full"
										data-testid="crew-skills-scroll-area"
									>
										<SidebarSkillList />
									</ScrollArea>
								</SidebarExpandableItem>
							)}
							{shouldRenderKnowledgeBaseEntry && (
								<>
									<Separator />
									<SidebarExpandableItem
										label={t("steps.knowledgeBase")}
										onClick={handleKnowledgeClick}
										isActive={isKnowledgeActive}
										isExpanded={isKnowledgeExpanded}
										trailing={
											<Button
												variant="ghost"
												size="icon"
												className="h-6 w-6"
												onClick={(event) => {
													event.stopPropagation()
													setEditingKnowledge(null)
													setKnowledgeDialogOpen(true)
												}}
												data-testid="crew-step-knowledge-base-add"
											>
												<Plus className="h-4 w-4" />
											</Button>
										}
										testId="crew-step-knowledge-base"
										className={cn(
											"flex flex-col",
											isKnowledgeExpanded && "min-h-0 flex-1",
										)}
										contentClassName={cn(
											"min-h-0",
											isKnowledgeExpanded && "flex-1",
										)}
										childrenClassName={cn(
											"min-h-0",
											isKnowledgeExpanded && "h-full",
										)}
									>
										<ScrollArea
											className="h-full [&_[data-slot='scroll-area-viewport']>div]:!block"
											data-testid="crew-knowledge-scroll-area"
										>
											<SidebarKnowledgeList
												onEditKnowledge={(kb) => {
													setEditingKnowledge(kb)
													setKnowledgeDialogOpen(true)
												}}
											/>
										</ScrollArea>
									</SidebarExpandableItem>
								</>
							)}
							{isCrewStepEnabled(CREW_EDIT_STEP.Playbook) && (
								<>
									<Separator />
									<SidebarExpandableItem
										label={t("scenarioPresets")}
										onClick={handlePlaybookClick}
										isActive={isPlaybookActive}
										isExpanded={isPlaybookExpanded}
										// leading={<SlidersHorizontal className="h-4 w-4" />}
										trailing={
											<Button
												variant="ghost"
												size="icon"
												className="h-6 w-6"
												onClick={handleCreatePlaybook}
												data-testid="crew-step-playbook-add"
											>
												<Plus className="h-4 w-4" />
											</Button>
										}
										testId="crew-scenario-presets-button"
									>
										<SidebarPlaybookList />
									</SidebarExpandableItem>
								</>
							)}
						</div>
					)}
				</div>
			</SidebarSection>

			<SidebarSection testId="crew-sidebar-footer-panel" className="shrink-0">
				{isCrewStepEnabled(CREW_EDIT_STEP.RunAndDebug) && (
					<SidebarRow
						label={t("steps.runAndDebug")}
						onClick={() => handleAdvancedStep(CREW_EDIT_STEP.RunAndDebug)}
						isActive={layout.activeDetailKey === CREW_EDIT_STEP.RunAndDebug}
						leading={<CirclePlay className="h-4 w-4" />}
						testId="crew-step-run-and-debug"
					/>
				)}
				{isCrewStepEnabled(CREW_EDIT_STEP.RunAndDebug) &&
					isCrewStepEnabled(CREW_EDIT_STEP.Publishing) && <Separator />}
				<CrewCollaboratorsEntry
					crewCode={crewCode}
					userRole={store.conversation.selectedProject?.user_role}
					showTrailingSeparator={isCrewStepEnabled(CREW_EDIT_STEP.Publishing)}
				/>
				{isCrewStepEnabled(CREW_EDIT_STEP.Publishing) && (
					<SidebarRow
						label={t("steps.publishing")}
						onClick={handleOpenPublishing}
						disabled={!canOpenAgentPublishPanel}
						hideChevron={!canOpenAgentPublishPanel}
						isActive={layout.activeDetailKey === CREW_EDIT_STEP.Publishing}
						leading={<CloudUpload className="h-4 w-4" />}
						trailing={
							!canOpenAgentPublishPanel ? (
								<span
									className="text-xs text-muted-foreground"
									data-testid="crew-step-publishing-no-permission"
								>
									{t("status.noPublishPermission")}
								</span>
							) : (
								<>
									{store.hasUnpublishedChanges ? (
										<Badge
											variant="secondary"
											className="h-5 rounded-md bg-amber-500/10 px-2 text-[10px] font-medium text-amber-500"
										>
											{t("status.unpublished")}
										</Badge>
									) : null}
									{isPublishingPending ? (
										<Loader2
											className="h-4 w-4 animate-spin text-muted-foreground"
											data-testid="crew-step-publishing-loading"
										/>
									) : null}
								</>
							)
						}
						testId="crew-step-publishing"
					/>
				)}
			</SidebarSection>
			<CreateKnowledgeDialog
				open={knowledgeDialogOpen}
				onOpenChange={(open) => {
					setKnowledgeDialogOpen(open)
					if (!open) setEditingKnowledge(null)
				}}
				onSuccess={() => void store.knowledge.fetchKnowledgeList(true, true)}
				editKnowledge={editingKnowledge}
			/>
			<EditCrewDialog
				open={isCrewIdentityDialogOpen}
				onOpenChange={handleCrewIdentityDialogOpenChange}
				onSuccess={handleCrewIdentitySaved}
				isPrePublishMode={isPublishIdentityDialogOpen}
				defaultNameRequiredMessage={t("publishNameDialog.required")}
			/>
		</div>
	)
}

export default observer(ConfigStepsPanel)
