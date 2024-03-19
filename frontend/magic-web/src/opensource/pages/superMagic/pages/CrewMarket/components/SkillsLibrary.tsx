import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import {
	CirclePlus,
	UserRoundCog,
	ChevronDown,
	MessageCircleMore,
	Upload,
	Github,
	Check,
	Loader2,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { Button } from "@/opensource/components/shadcn-ui/button"
import MagicDropdown from "@/opensource/components/base/MagicDropdown"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { RouteName } from "@/opensource/routes/constants"
import ImportSkillDialog from "@/opensource/pages/superMagic/components/ImportSkillDialog"
import SkillCard from "./SkillCard"
import { cn } from "@/opensource/lib/utils"
import { StoreSkillsStore } from "../stores/store-skills"

function SkillsLibrary() {
	const { t } = useTranslation("crew/market")
	const navigate = useNavigate()
	const skillsStore = useMemo(() => new StoreSkillsStore(), [])
	const sentinelRef = useRef<HTMLDivElement | null>(null)
	const [importDialogOpen, setImportDialogOpen] = useState(false)

	useEffect(() => {
		void skillsStore.fetchSkills()
		return () => skillsStore.reset()
	}, [skillsStore])

	useEffect(() => {
		const sentinel = sentinelRef.current
		if (!sentinel) return

		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return
				if (skillsStore.loading || skillsStore.loadingMore || !skillsStore.hasMore) return
				void skillsStore.loadMore()
			},
			{ rootMargin: "160px 0px" },
		)
		observer.observe(sentinel)
		return () => observer.disconnect()
	}, [skillsStore, skillsStore.loading, skillsStore.loadingMore, skillsStore.hasMore])

	const handleAdd = useCallback(
		(id: string) => {
			void skillsStore.addSkill(id)
		},
		[skillsStore],
	)

	const handleRemove = useCallback(
		(id: string) => {
			void skillsStore.removeSkill(id)
		},
		[skillsStore],
	)

	const handleUpgrade = useCallback(
		(id: string) => {
			void skillsStore.upgradeSkill(id)
		},
		[skillsStore],
	)

	const handleSearch = useCallback(
		(query: string) => {
			skillsStore.reset()
			void skillsStore.fetchSkills({ page: 1, keyword: query.trim() || undefined })
		},
		[skillsStore],
	)

	function handleCreateViaChat() {
		// TODO: navigate to chat creation
	}

	function handleImportSkill() {
		setImportDialogOpen(true)
	}

	function handleImportFromGithub() {
		// TODO: open github import dialog
	}

	function handleMySkills() {
		navigate({ name: RouteName.MySkills })
	}

	const createSkillMenuItems = useMemo(
		() => [
			// {
			// 	key: "create-via-chat",
			// 	icon: <MessageCircleMore className="mt-0.5 size-4 shrink-0" />,
			// 	label: (
			// 		<div className="flex flex-col gap-1">
			// 			<span className="text-sm font-medium">
			// 				{t("skillsLibrary.createMenu.createViaChat")}
			// 			</span>
			// 			<span className="text-xs text-muted-foreground">
			// 				{t("skillsLibrary.createMenu.createViaChatDesc")}
			// 			</span>
			// 		</div>
			// 	),
			// 	onClick: handleCreateViaChat,
			// 	"data-testid": "skills-create-via-chat",
			// },
			{
				key: "import-skill",
				icon: <Upload className="mt-0.5 size-4 shrink-0" />,
				label: (
					<div className="flex flex-col gap-1">
						<span className="text-sm font-medium">
							{t("skillsLibrary.createMenu.importSkill")}
						</span>
						<span className="text-xs text-muted-foreground">
							{t("skillsLibrary.createMenu.importSkillDesc")}
						</span>
					</div>
				),
				onClick: handleImportSkill,
				"data-testid": "skills-import-skill",
			},
			{
				key: "import-github",
				icon: <Github className="mt-0.5 size-4 shrink-0" />,
				label: (
					<div className="flex flex-col gap-1">
						<span className="text-sm font-medium">
							{t("skillsLibrary.createMenu.importFromGithub")}
						</span>
						<span className="text-xs text-muted-foreground">
							{t("skillsLibrary.createMenu.importFromGithubDesc")}
						</span>
					</div>
				),
				onClick: handleImportFromGithub,
				"data-testid": "skills-import-github",
			},
		],
		[t],
	)

	return (
		<div
			className="mt-5 flex min-w-0 flex-col gap-5 sm:mt-6 sm:gap-6"
			data-testid="skills-library"
		>
			{/* Title + action buttons */}
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<h1 className="break-words text-2xl leading-tight text-foreground sm:text-3xl lg:text-4xl">
						{t("skillsLibrary.title")}
					</h1>
					<p className="max-w-2xl break-words text-sm text-muted-foreground">
						{t("skillsLibrary.subtitle")}
					</p>
				</div>
				<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
					<MagicDropdown
						menu={{ items: createSkillMenuItems }}
						placement="bottomRight"
						overlayClassName={cn(
							"w-80",
							"[&_[data-slot='dropdown-menu-item']]:items-start",
							"[&_[data-slot='dropdown-menu-item']]:!p-2",
						)}
					>
						<span>
							<Button
								className="h-9 flex-1 gap-2 shadow-xs sm:flex-none"
								data-testid="skills-library-create-button"
							>
								<CirclePlus className="h-4 w-4" />
								{t("skillsLibrary.createSkill")}
								<ChevronDown className="h-4 w-4" />
							</Button>
						</span>
					</MagicDropdown>
					<Button
						variant="outline"
						className="h-9 flex-1 gap-2 bg-background shadow-xs sm:flex-none"
						onClick={handleMySkills}
						data-testid="skills-library-my-skills-button"
					>
						<UserRoundCog className="h-4 w-4" />
						{t("skillsLibrary.mySkills")}
					</Button>
				</div>
			</div>

			{/* Search */}
			{/* <SearchBar
				onSearch={handleSearch}
				placeholder={t("skillsLibrary.aiSearchPlaceholder")}
				data-testid="skills-library-search-bar"
			/> */}

			{/* Skill card grid */}
			{skillsStore.loading && skillsStore.list.length === 0 ? (
				<div
					className="flex items-center justify-center py-8"
					data-testid="skills-library-loading"
				>
					<Loader2 className="size-5 animate-spin text-muted-foreground" />
				</div>
			) : skillsStore.isEmpty ? (
				<div
					className="flex items-center justify-center py-8 text-sm text-muted-foreground"
					data-testid="skills-library-empty"
				>
					{t("skillsLibrary.noMoreData")}
				</div>
			) : (
				<div
					className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
					data-testid="skill-card-grid"
				>
					{skillsStore.list.map((skill) => (
						<SkillCard
							key={skill.id}
							skill={skill}
							onAdd={handleAdd}
							onRemove={handleRemove}
							onUpgrade={handleUpgrade}
						/>
					))}
				</div>
			)}

			<div
				ref={sentinelRef}
				className="h-1 w-full"
				data-testid="skills-library-scroll-sentinel"
			/>

			{skillsStore.loadingMore ? (
				<div
					className="flex items-center justify-center py-2"
					data-testid="skills-library-loading-more"
				>
					<Loader2 className="size-4 animate-spin text-muted-foreground" />
				</div>
			) : null}

			{!skillsStore.hasMore && skillsStore.list.length > 0 ? (
				<div
					className="flex items-center justify-center gap-1 py-2 opacity-30"
					data-testid="skills-library-no-more"
				>
					<Check className="size-4" />
					<span className="text-xs">{t("skillsLibrary.noMoreData")}</span>
				</div>
			) : null}

			<ImportSkillDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
		</div>
	)
}

export default observer(SkillsLibrary)
