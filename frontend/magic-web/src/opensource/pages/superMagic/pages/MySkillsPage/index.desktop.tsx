import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { CirclePlus, ChevronDown, Check, Upload, Github, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { ScrollArea } from "@/opensource/components/shadcn-ui/scroll-area"
import MagicDropdown from "@/opensource/components/base/MagicDropdown"
import { cn } from "@/opensource/lib/utils"
import ImportSkillDialog from "@/opensource/pages/superMagic/components/ImportSkillDialog"
import PageTopBar from "@/opensource/pages/superMagic/components/PageTopBar"
import { useUpload } from "@/opensource/hooks/useUploadFiles"
import { skillsService } from "@/opensource/services/skills/SkillsService"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import EditSkillDialog from "./components/EditSkillDialog"
import MySkillCard from "./components/MySkillCard"
import { UserSkillsStore } from "./stores/user-skills"

function MySkillsPage() {
	const { t } = useTranslation("crew/market")
	const userSkillsStore = useMemo(() => new UserSkillsStore(), [])
	const sentinelRef = useRef<HTMLDivElement | null>(null)
	const [importDialogOpen, setImportDialogOpen] = useState(false)
	const [editingSkillCode, setEditingSkillCode] = useState<string | null>(null)
	const updateFileInputRef = useRef<HTMLInputElement>(null)
	const updatingSkillIdRef = useRef<string | null>(null)
	const { upload } = useUpload({ storageType: "private" })

	useEffect(() => {
		void userSkillsStore.fetchSkills()
		return () => userSkillsStore.reset()
	}, [userSkillsStore])

	useEffect(() => {
		const sentinel = sentinelRef.current
		if (!sentinel) return

		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return
				if (
					userSkillsStore.loading ||
					userSkillsStore.loadingMore ||
					!userSkillsStore.hasMore
				) {
					return
				}
				void userSkillsStore.loadMore()
			},
			{ rootMargin: "160px 0px" },
		)
		observer.observe(sentinel)
		return () => observer.disconnect()
	}, [
		userSkillsStore,
		userSkillsStore.loading,
		userSkillsStore.loadingMore,
		userSkillsStore.hasMore,
	])

	const handleEdit = useCallback(
		(id: string) => {
			const skill = userSkillsStore.list.find((s) => s.id === id)
			if (skill) setEditingSkillCode(skill.skillCode)
		},
		[userSkillsStore.list],
	)

	const handleDelete = useCallback(
		(id: string) => {
			void userSkillsStore.deleteSkill(id)
		},
		[userSkillsStore],
	)

	// Directly trigger file picker inside the user-gesture call chain
	const handleUpdate = useCallback((id: string) => {
		updatingSkillIdRef.current = id
		updateFileInputRef.current?.click()
	}, [])

	const handleUpdateFileChange = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0]
			// Reset so the same file can be re-selected next time
			e.target.value = ""
			if (!file) return

			try {
				const { fullfilled, rejected } = await upload([
					{ name: file.name, file, status: "init" },
				])
				if (rejected.length > 0 || fullfilled.length === 0) {
					magicToast.error(t("updateSkill.errors.parseFailed"))
					return
				}
				const fileKey = fullfilled[0].value.key
				const parseResult = await skillsService.parseSkillFile(fileKey)
				const skill = userSkillsStore.list.find((s) => s.id === updatingSkillIdRef.current)
				await skillsService.importSkill({
					import_token: parseResult.import_token,
					name_i18n: skill?.nameI18n ?? parseResult.name_i18n,
					description_i18n: skill?.descriptionI18n ?? parseResult.description_i18n,
					logo: skill?.logo || parseResult.logo || undefined,
				})
				magicToast.success(t("updateSkill.done"))
				void userSkillsStore.fetchSkills()
			} catch {
				magicToast.error(t("updateSkill.errors.updateFailed"))
			} finally {
				updatingSkillIdRef.current = null
			}
		},
		[upload, t, userSkillsStore],
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
			// 	"data-testid": "my-skills-create-via-chat",
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
				"data-testid": "my-skills-import-skill",
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
				"data-testid": "my-skills-import-github",
			},
		],
		[t],
	)

	return (
		<div
			className="shadow-xs flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background"
			data-testid="my-skills-page"
		>
			{/* Top header bar */}
			<PageTopBar data-testid="my-skills-top-bar" backButtonTestId="my-skills-back-button" />

			{/* Main scrollable section */}
			<ScrollArea className="min-h-0 flex-1">
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
										className="shadow-xs h-9 flex-1 gap-2 sm:flex-none"
										data-testid="my-skills-create-button"
									>
										<CirclePlus className="h-4 w-4" />
										{t("skillsLibrary.createSkill")}
										<ChevronDown className="h-4 w-4" />
									</Button>
								</span>
							</MagicDropdown>
						</div>
					</div>

					{/* Skill card grid */}
					{userSkillsStore.loading && userSkillsStore.list.length === 0 ? (
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
							className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3"
							data-testid="my-skill-card-grid"
						>
							{userSkillsStore.list.map((skill) => (
								<MySkillCard
									key={skill.id}
									skill={skill}
									onEdit={handleEdit}
									onUpdate={handleUpdate}
									onDelete={handleDelete}
								/>
							))}
						</div>
					)}

					<div
						ref={sentinelRef}
						className="h-1 w-full"
						data-testid="my-skills-scroll-sentinel"
					/>

					{userSkillsStore.loadingMore ? (
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

			{/* Hidden file input — clicked directly in handleUpdate (user-gesture context) */}
			<input
				ref={updateFileInputRef}
				type="file"
				accept=".zip,.skill"
				className="hidden"
				onChange={handleUpdateFileChange}
				data-testid="update-skill-file-input"
			/>

			<ImportSkillDialog
				open={importDialogOpen}
				onOpenChange={setImportDialogOpen}
				onSuccess={() => void userSkillsStore.fetchSkills()}
			/>

			<EditSkillDialog
				open={!!editingSkillCode}
				onOpenChange={(v) => !v && setEditingSkillCode(null)}
				skillCode={editingSkillCode}
				onSuccess={() => void userSkillsStore.fetchSkills()}
			/>
		</div>
	)
}

export default observer(MySkillsPage)
