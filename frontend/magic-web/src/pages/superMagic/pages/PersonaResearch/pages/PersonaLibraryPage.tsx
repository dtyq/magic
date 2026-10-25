import { Fragment, useEffect, useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import {
	ArrowLeft,
	ArrowRight,
	CircleCheck,
	CircleMinus,
	Ellipsis,
	Eye,
	LibraryBig,
	MessagesSquare,
	Pencil,
	Search,
	SearchX,
	SquarePen,
	Trash2,
	UsersRound,
	X,
	type LucideIcon,
} from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"
import { Button } from "@/components/shadcn-ui/button"
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/shadcn-ui/context-menu"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/shadcn-ui/empty"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import MagicTooltip from "@/components/base/MagicTooltip"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useNavigate } from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { cn } from "@/utils/cn"
import { usePersonaResearchStore } from "../context"
import { useResearchBack } from "../hooks/useResearchBack"
import CreatePersonaMenu from "../components/CreatePersonaMenu"
import PersonaAvatar from "../components/PersonaAvatar"
import PersonaBuildSheet from "../components/PersonaBuildSheet"
import PersonaCard from "../components/PersonaCard"
import PersonaDetailSheet from "../components/PersonaDetailSheet"
import PersonaFormDialog from "../components/PersonaForm"
import { deletePersonaFile } from "../services/personaWriter"
import type { PersonaFile, PersonaTier, ResearchFileRef } from "../types"

type TierFilter = "all" | PersonaTier

/** How long a newly saved persona keeps its green "new" highlight after the last arrival. */
const NEW_HIGHLIGHT_MS = 6000

/** Persona library: browse reusable personas and panels, then start a study with them. */
function PersonaLibraryPage() {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()
	const navigate = useNavigate()
	const goBack = useResearchBack()
	const isMobile = useIsMobile()
	const [view, setView] = useState<"personas" | "panels">("personas")
	const [tier, setTier] = useState<TierFilter>("all")
	const [keyword, setKeyword] = useState("")
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [openedPersona, setOpenedPersona] = useState<PersonaFile | null>(null)
	const [formOpen, setFormOpen] = useState(false)
	const [editing, setEditing] = useState<ResearchFileRef<PersonaFile> | null>(null)
	const [buildOpen, setBuildOpen] = useState(false)
	/** Persona ids already in the library when the build sheet opened; anything else is new. */
	const [buildBaseline, setBuildBaseline] = useState<Set<string>>(new Set())
	const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set())
	const [pendingDelete, setPendingDelete] = useState<PersonaFile | null>(null)
	const canEdit = !store.isReadOnly

	// Other research pages read only the personas they show; this page needs the whole library.
	useEffect(() => {
		store.requestLibrary()
	}, [store])

	const pathById = useMemo(
		() => new Map(store.personas.map((ref) => [ref.data.id, ref.path])),
		[store.personas],
	)

	const tierCounts = useMemo(() => {
		const counts: Record<TierFilter, number> = {
			all: store.personas.length,
			evidence_based: 0,
			imported: 0,
			manual: 0,
			generated: 0,
		}
		for (const ref of store.personas) counts[ref.data.tier] += 1
		return counts
	}, [store.personas])

	/** Newest personas first, so the ones from the latest study are on top. */
	const filtered = useMemo(() => {
		const query = keyword.trim().toLowerCase()
		return store.personas
			.map((ref) => ref.data)
			.filter((persona) => tier === "all" || persona.tier === tier)
			.filter((persona) => {
				if (!query) return true
				return [persona.name, persona.tagline ?? "", ...(persona.tags ?? [])]
					.join(" ")
					.toLowerCase()
					.includes(query)
			})
			.sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))
	}, [keyword, store.personas, tier])

	/**
	 * Hands the chosen personas to the home composer, which shows them by the settings and sends
	 * their files with the study; nothing is written into the question itself.
	 */
	const startStudyWith = useMemoizedFn((personaIds: string[]) => {
		const picks = personaIds.flatMap((id) => {
			const path = pathById.get(id)
			const persona = store.personaById(id)
			return path && persona
				? [
						{
							id,
							name: persona.name,
							path,
							demographics: persona.dimensions?.demographics,
						},
					]
				: []
		})
		if (picks.length === 0) return
		store.addStudyPersonaPicks(picks)
		navigate({ name: RouteName.PersonaResearch })
	})

	const highlight = useMemoizedFn((ids: string[]) => {
		if (ids.length === 0) return
		setHighlightIds((current) => new Set([...current, ...ids]))
	})

	// Fade the "new" marks out a while after the last persona arrived.
	useEffect(() => {
		if (highlightIds.size === 0) return
		const timer = window.setTimeout(() => setHighlightIds(new Set()), NEW_HIGHLIGHT_MS)
		return () => window.clearTimeout(timer)
	}, [highlightIds])

	/** Personas the agent saved during the open build conversation, newest first. */
	const builtPersonas = useMemo(
		() =>
			buildOpen
				? store.personas
						.map((ref) => ref.data)
						.filter((persona) => !buildBaseline.has(persona.id))
				: [],
		[buildBaseline, buildOpen, store.personas],
	)
	const builtIdsKey = builtPersonas.map((persona) => persona.id).join(",")
	useEffect(() => {
		if (builtIdsKey) highlight(builtIdsKey.split(","))
	}, [builtIdsKey, highlight])

	const openBuild = useMemoizedFn(() => {
		setFormOpen(false)
		setBuildBaseline(new Set(store.personas.map((ref) => ref.data.id)))
		setBuildOpen(true)
	})

	const openCreateForm = useMemoizedFn(() => {
		setEditing(null)
		setFormOpen(true)
	})

	const openEditForm = useMemoizedFn((persona: PersonaFile) => {
		const ref = store.personaRefById(persona.id)
		if (!ref) return
		setOpenedPersona(null)
		setEditing(ref)
		setFormOpen(true)
	})

	const requestDelete = useMemoizedFn((persona: PersonaFile) => {
		setOpenedPersona(null)
		setPendingDelete(persona)
	})

	const confirmDelete = useMemoizedFn(async () => {
		const persona = pendingDelete
		setPendingDelete(null)
		const ref = persona ? store.personaRefById(persona.id) : null
		if (!ref) return
		const deleted = await deletePersonaFile(store, ref)
		if (deleted) {
			toggleSelected(ref.data.id, false)
			toast.success(t("library.deleted"))
		} else {
			toast.error(t("library.deleteFailed"))
		}
	})

	const toggleSelected = useMemoizedFn((id: string, selected: boolean) => {
		setSelectedIds((current) => {
			const next = new Set(current)
			if (selected) next.add(id)
			else next.delete(id)
			return next
		})
	})

	const allTierTabs: { value: TierFilter; label: string }[] = [
		{ value: "all", label: t("library.tierAll") },
		{ value: "evidence_based", label: t("persona.tier.evidenceBased") },
		{ value: "imported", label: t("persona.tier.imported") },
		{ value: "manual", label: t("persona.tier.manual") },
		{ value: "generated", label: t("persona.tier.generated") },
	]
	// Tiers with no persona stay hidden unless selected, e.g. "Manual" before the first one.
	const tierTabs = allTierTabs.filter(
		({ value }) => value === "all" || tierCounts[value] > 0 || tier === value,
	)
	const selectedPersonas = [...selectedIds]
		.map((id) => store.personaById(id))
		.filter((persona): persona is PersonaFile => persona !== null)

	return (
		<div
			className="relative flex h-full min-h-0 flex-col bg-background"
			data-testid="persona-research-library"
		>
			<div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-3">
				<div className="flex items-center gap-2">
					<MagicTooltip title={t("study.backHome")}>
						<Button
							variant="ghost"
							size="icon"
							className="size-8"
							aria-label={t("study.backHome")}
							onClick={goBack}
						>
							<ArrowLeft className="size-4" />
						</Button>
					</MagicTooltip>
					<div className="flex flex-1 flex-col">
						<h1 className="text-sm font-semibold">{t("library.title")}</h1>
						{isMobile ? null : (
							<p className="text-xs text-muted-foreground">{t("library.subtitle")}</p>
						)}
					</div>
					{canEdit ? (
						<CreatePersonaMenu
							onCreateWithChat={openBuild}
							onCreateManually={openCreateForm}
						/>
					) : null}
				</div>
				{/* Below the title row on phones: beside the create button the text is squeezed into a
				    column a few words wide (eight lines in English). */}
				{isMobile ? (
					<p className="text-xs text-muted-foreground">{t("library.subtitle")}</p>
				) : null}
				<div className={cn("flex gap-2", isMobile ? "flex-col" : "items-center")}>
					<Tabs value={view} onValueChange={(value) => setView(value as typeof view)}>
						<TabsList>
							<TabsTrigger value="personas" className="gap-1.5">
								<UsersRound className="size-3.5" />
								{t("library.personas")}
								<CountBadge value={store.personaFileCount} />
							</TabsTrigger>
							<TabsTrigger value="panels" className="gap-1.5">
								<LibraryBig className="size-3.5" />
								{t("library.panels")}
								<CountBadge value={store.panelFileCount} />
							</TabsTrigger>
						</TabsList>
					</Tabs>
					{view === "personas" ? (
						<>
							<div className="flex flex-wrap gap-1">
								{tierTabs.map(({ value, label }) => (
									<button
										key={value}
										type="button"
										aria-pressed={tier === value}
										onClick={() => setTier(value)}
										className={cn(
											"flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
											tier === value
												? "border-primary bg-primary/10 text-primary"
												: "border-border text-muted-foreground hover:text-foreground",
										)}
									>
										{label}
										<span className="tabular-nums opacity-70">
											{tierCounts[value]}
										</span>
									</button>
								))}
							</div>
							<div className="relative flex-1">
								<Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={keyword}
									onChange={(event) => setKeyword(event.target.value)}
									placeholder={t("library.search")}
									className="h-8 pl-8"
								/>
							</div>
						</>
					) : null}
				</div>
			</div>

			<ScrollArea className="min-h-0 flex-1" viewportClassName="[&>div]:!block">
				{!store.libraryLoaded ? (
					<LibrarySkeleton />
				) : view === "personas" ? (
					filtered.length === 0 ? (
						store.personas.length === 0 ? (
							<LibraryEmpty
								icon={<UsersRound />}
								title={t("library.emptyTitle")}
								text={t("library.empty")}
								action={
									<div className="flex flex-col items-center gap-3">
										{canEdit ? (
											<div className="flex flex-wrap justify-center gap-2">
												<Button size="sm" onClick={openBuild}>
													<MessagesSquare className="size-4" />
													{t("library.createChat")}
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={openCreateForm}
												>
													<SquarePen className="size-4" />
													{t("library.createManual")}
												</Button>
											</div>
										) : null}
										<Button
											variant="link"
											size="sm"
											className="h-auto p-0 text-xs text-muted-foreground"
											onClick={() =>
												navigate({ name: RouteName.PersonaResearch })
											}
										>
											{t("library.goStudy")}
										</Button>
									</div>
								}
							/>
						) : (
							<LibraryEmpty
								icon={<SearchX />}
								title={t("library.noMatchTitle")}
								text={t("library.noMatch")}
								action={
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											setKeyword("")
											setTier("all")
										}}
									>
										{t("library.resetFilters")}
									</Button>
								}
							/>
						)
					) : (
						<div
							className={cn(
								"grid gap-3 p-4",
								isMobile
									? "grid-cols-1"
									: "grid-cols-[repeat(auto-fill,minmax(280px,1fr))]",
								// Leave room for the floating selection bar.
								selectedIds.size > 0 && "pb-24",
							)}
						>
							{filtered.map((persona) => {
								const selected = selectedIds.has(persona.id)
								// One action list for the hover "…" menu and the right-click menu.
								const actions: CardAction[] = [
									{
										key: "open",
										icon: Eye,
										label: t("library.viewDetail"),
										onSelect: () => setOpenedPersona(persona),
									},
									{
										key: "select",
										icon: selected ? CircleMinus : CircleCheck,
										label: t(selected ? "library.unselect" : "library.select"),
										onSelect: () => toggleSelected(persona.id, !selected),
									},
									...(canEdit
										? [
												{
													key: "edit",
													icon: Pencil,
													label: t("library.edit"),
													onSelect: () => openEditForm(persona),
												},
												{
													key: "delete",
													icon: Trash2,
													label: t("library.delete"),
													onSelect: () => requestDelete(persona),
													destructive: true,
												},
											]
										: []),
								]
								return (
									<ContextMenu key={persona.id}>
										<ContextMenuTrigger asChild>
											<div className="h-full">
												<PersonaCard
													persona={persona}
													selectable
													selected={selected}
													onSelectedChange={(next) =>
														toggleSelected(persona.id, next)
													}
													isNew={highlightIds.has(persona.id)}
													actions={<PersonaCardMenu actions={actions} />}
													onOpen={() => setOpenedPersona(persona)}
												/>
											</div>
										</ContextMenuTrigger>
										<ContextMenuContent className="w-44">
											{actions.map((action) => (
												<Fragment key={action.key}>
													{action.destructive ? (
														<ContextMenuSeparator />
													) : null}
													<ContextMenuItem
														className={cn(
															action.destructive &&
																"text-destructive",
														)}
														onSelect={action.onSelect}
													>
														<action.icon className="size-4" />
														{action.label}
													</ContextMenuItem>
												</Fragment>
											))}
										</ContextMenuContent>
									</ContextMenu>
								)
							})}
						</div>
					)
				) : store.panels.length === 0 ? (
					<LibraryEmpty
						icon={<LibraryBig />}
						title={t("library.panelsEmptyTitle")}
						text={t("library.panelsEmpty")}
					/>
				) : (
					<ul
						className={cn(
							"grid gap-3 p-4",
							isMobile
								? "grid-cols-1"
								: "grid-cols-[repeat(auto-fill,minmax(320px,1fr))]",
						)}
					>
						{store.panels.map((ref) => (
							<li
								key={ref.fileId}
								className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
							>
								<div className="min-w-0">
									<div className="truncate text-sm font-semibold">
										{ref.data.name}
									</div>
									{ref.data.criteria ? (
										<div className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
											{ref.data.criteria}
										</div>
									) : null}
								</div>
								<div className="flex items-center justify-between gap-3">
									<span className="flex items-center gap-2">
										<span className="flex -space-x-1.5">
											{ref.data.persona_ids.slice(0, 6).map((id) => (
												<PersonaAvatar
													key={id}
													id={id}
													name={store.personaById(id)?.name ?? id}
													className="size-7 border-2 border-card text-[10px]"
												/>
											))}
										</span>
										<span className="text-xs text-muted-foreground">
											{t("library.panelSize", {
												count: ref.data.persona_ids.length,
											})}
										</span>
									</span>
									<Button
										size="sm"
										variant="outline"
										onClick={() => startStudyWith(ref.data.persona_ids)}
									>
										{t("library.startWithPanel")}
										<ArrowRight className="size-3.5" />
									</Button>
								</div>
							</li>
						))}
					</ul>
				)}
			</ScrollArea>

			{view === "personas" && selectedPersonas.length > 0 ? (
				// Floating bar keeps the grid visible while personas are being picked.
				<div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
					<div className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border border-border bg-background/95 px-3 py-2.5 shadow-lg backdrop-blur animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none">
						<span className="flex -space-x-1.5">
							{selectedPersonas.slice(0, 5).map((persona) => (
								<PersonaAvatar
									key={persona.id}
									id={persona.id}
									name={persona.name}
									className="size-7 border-2 border-background text-[10px]"
								/>
							))}
						</span>
						<span className="min-w-0 flex-1 truncate text-sm">
							{t("library.selected", { count: selectedPersonas.length })}
						</span>
						<MagicTooltip title={t("library.clearSelection")}>
							<Button
								variant="ghost"
								size="icon"
								className="size-8"
								aria-label={t("library.clearSelection")}
								onClick={() => setSelectedIds(new Set())}
							>
								<X className="size-4" />
							</Button>
						</MagicTooltip>
						<Button
							size="sm"
							onClick={() =>
								startStudyWith(selectedPersonas.map((persona) => persona.id))
							}
						>
							{t("library.startWithSelected")}
							<ArrowRight className="size-3.5" />
						</Button>
					</div>
				</div>
			) : null}

			<PersonaDetailSheet
				persona={openedPersona}
				onOpenChange={(open) => !open && setOpenedPersona(null)}
				onEdit={canEdit ? openEditForm : undefined}
				onDelete={canEdit ? requestDelete : undefined}
				side={isMobile ? "bottom" : "center"}
			/>

			<PersonaFormDialog
				open={formOpen}
				editing={editing}
				onOpenChange={setFormOpen}
				onSaved={(personaId) => highlight([personaId])}
				onSwitchToChat={openBuild}
			/>

			<PersonaBuildSheet
				open={buildOpen}
				onOpenChange={setBuildOpen}
				savedPersonas={builtPersonas}
				onStartStudy={startStudyWith}
			/>

			<AlertDialog
				open={Boolean(pendingDelete)}
				onOpenChange={(open) => !open && setPendingDelete(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("library.deleteTitle", { name: pendingDelete?.name ?? "" })}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("library.deleteDescription")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("library.cancel")}</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-white hover:bg-destructive/90"
							onClick={() => void confirmDelete()}
						>
							{t("library.deleteConfirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}

/** First read of the library; without it an unread library would flash the empty state. */
function LibrarySkeleton() {
	const isMobile = useIsMobile()
	return (
		<div
			className={cn(
				"grid gap-3 p-4",
				isMobile ? "grid-cols-1" : "grid-cols-[repeat(auto-fill,minmax(280px,1fr))]",
			)}
		>
			{Array.from({ length: 8 }, (_, index) => (
				<Skeleton key={index} className="h-40 rounded-xl" />
			))}
		</div>
	)
}

interface CardAction {
	key: string
	icon: LucideIcon
	label: string
	onSelect: () => void
	destructive?: boolean
}

/** The hover "…" menu on a persona card; the same actions open on right-click. */
function PersonaCardMenu({ actions }: { actions: CardAction[] }) {
	const { t } = useTranslation("personaResearch")
	return (
		<DropdownMenu>
			<MagicTooltip title={t("library.moreActions")}>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="size-6 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
						aria-label={t("library.moreActions")}
					>
						<Ellipsis className="size-4" />
					</Button>
				</DropdownMenuTrigger>
			</MagicTooltip>
			<DropdownMenuContent align="end" className="w-44">
				{actions.map((action) => (
					<Fragment key={action.key}>
						{action.destructive ? <DropdownMenuSeparator /> : null}
						<DropdownMenuItem
							className={cn(action.destructive && "text-destructive")}
							onSelect={action.onSelect}
						>
							<action.icon className="size-4" />
							{action.label}
						</DropdownMenuItem>
					</Fragment>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function CountBadge({ value }: { value: number }) {
	if (value <= 0) return null
	return (
		<span className="rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">
			{value}
		</span>
	)
}

function LibraryEmpty({
	icon,
	title,
	text,
	action,
}: {
	icon: React.ReactNode
	title: string
	text: string
	action?: React.ReactNode
}) {
	return (
		<Empty className="py-16">
			<EmptyHeader>
				<EmptyMedia variant="icon">{icon}</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{text}</EmptyDescription>
			</EmptyHeader>
			{action ? <EmptyContent>{action}</EmptyContent> : null}
		</Empty>
	)
}

export default observer(PersonaLibraryPage)
