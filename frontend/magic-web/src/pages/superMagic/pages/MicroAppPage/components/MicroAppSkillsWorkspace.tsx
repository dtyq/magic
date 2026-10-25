import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { useEffect, useRef, useState } from "react"
import { BookOpen, FileText, Loader2, Pencil, Plus, MessageSquarePlus, Save, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { loadProjectSkills, type ProjectSkill } from "@/pages/superMagic/components/microAppSkills"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import MarkdownPreview from "@/pages/superMagic/components/Detail/contents/Md"
import EditorBody from "@/pages/superMagic/components/Detail/contents/Md/components/EditorBody"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"

import MicroAppSkillCreateDialog from "./MicroAppSkillCreateDialog"
import { useMicroAppSkillActions } from "./useMicroAppSkillActions"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"

interface MicroAppSkillsWorkspaceProps {
	attachmentList: AttachmentItem[]
	canEdit?: boolean
}

export default function MicroAppSkillsWorkspace({
	attachmentList,
	canEdit = false,
}: MicroAppSkillsWorkspaceProps) {
	const fileApi = useFileApi()
	const actions = useMicroAppSkillActions(attachmentList, canEdit)
	const [createOpen, setCreateOpen] = useState(false)
	const createTriggerRef = useRef<HTMLButtonElement | null>(null)
	const { t, i18n } = useTranslation("super")
	const [skills, setSkills] = useState<ProjectSkill[]>([])
	const [selectedSkillId, setSelectedSkillId] = useState<string>()
	const [loading, setLoading] = useState(true)
	const [loadFailed, setLoadFailed] = useState(false)
	const [editing, setEditing] = useState(false)
	const [draftContent, setDraftContent] = useState("")
	const [saving, setSaving] = useState(false)
	const language = i18n?.resolvedLanguage ?? i18n?.language ?? "zh_CN"
	const selectedSkill = skills.find((skill) => skill.id === selectedSkillId)
	const selectedSkillContent = selectedSkill?.content
	const hasChanges = Boolean(selectedSkill && draftContent !== selectedSkill.content)

	useEffect(() => {
		let active = true
		setLoading(true)
		setLoadFailed(false)

		void loadProjectSkills(attachmentList, language, fileApi)
			.then((nextSkills) => {
				if (!active) return
				setSkills(nextSkills)
				setSelectedSkillId((currentId) =>
					nextSkills.some((skill) => skill.id === currentId) ? currentId : undefined,
				)
				setEditing(false)
				setDraftContent("")
			})
			.catch(() => {
				if (active) {
					setSkills([])
					setSelectedSkillId(undefined)
					setLoadFailed(true)
				}
			})
			.finally(() => {
				if (active) setLoading(false)
			})

		return () => {
			active = false
		}
	}, [attachmentList, fileApi, language])

	useEffect(() => {
		if (selectedSkillContent === undefined) {
			setDraftContent("")
			setEditing(false)
			return
		}
		setDraftContent(selectedSkillContent)
		setEditing(false)
	}, [selectedSkillId, selectedSkillContent])

	const handleSave = async () => {
		if (!selectedSkill || saving || !hasChanges) return
		setSaving(true)
		try {
			await SuperMagicApi.saveFileContent([
				{ file_id: selectedSkill.id, content: draftContent },
			])
			setSkills((current) =>
				current.map((skill) =>
					skill.id === selectedSkill.id ? { ...skill, content: draftContent } : skill,
				),
			)
			setEditing(false)
			magicToast.success(t("microAppPage.skills.saveSuccess"))
		} catch {
			magicToast.error(t("microAppPage.skills.saveFailed"))
		} finally {
			setSaving(false)
		}
	}

	const createButton = actions.enabled ? (
		<Button
			size="sm"
			onClick={(event) => {
				createTriggerRef.current = event.currentTarget
				setCreateOpen(true)
			}}
		>
			<Plus className="size-4" aria-hidden />
			{t("microAppPage.skills.create")}
		</Button>
	) : null

	return (
		<div
			className="flex h-full min-h-0 flex-col bg-background"
			data-testid="micro-app-skills-workspace"
		>
			<header className="flex min-h-12 shrink-0 items-center border-b border-border px-5 py-2.5">
				<div className="min-w-0">
					<h1 className="text-sm font-semibold leading-5 text-foreground">
						{t("microAppPage.skills.title")}
					</h1>
					<p className="text-xs leading-4 text-muted-foreground">
						{t("microAppPage.skills.workspaceSubtitle")}
					</p>
				</div>
				<div className="ml-auto pl-4">{createButton}</div>
			</header>
			{actions.enabled ? (
				<MicroAppSkillCreateDialog
					open={createOpen}
					onOpenChange={setCreateOpen}
					onCreate={actions.createSkill}
					onCloseAutoFocus={() => createTriggerRef.current?.focus()}
				/>
			) : null}

			<div className="flex min-h-0 flex-1">
				<aside
					className="flex w-[280px] shrink-0 flex-col overflow-hidden border-r border-border bg-muted/10"
					aria-label={t("microAppPage.skills.title")}
				>
					{/* Let the empty state fill the Radix content wrapper so its action stays centered. */}
					<ScrollArea
						className="min-h-0 flex-1"
						viewportClassName="h-full [&>div]:!flex [&>div]:min-h-full [&>div]:flex-col p-2"
					>
						{loading ? (
							<div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
								<Loader2 className="size-4 animate-spin" aria-hidden />
								{t("microAppPage.skills.loading")}
							</div>
						) : loadFailed ? (
							<div className="flex min-h-32 items-center justify-center px-4 text-center text-sm text-muted-foreground">
								{t("microAppPage.skills.loadFailed")}
							</div>
						) : skills.length ? (
							<div className="space-y-1">
								{skills.map((skill) => {
									const selected = skill.id === selectedSkillId
									return (
										<Button
											key={skill.id}
											draggable={
												actions.enabled &&
												Boolean(actions.getFolder(skill.directory))
											}
											onDragStart={(event) =>
												actions.startDrag(event, skill.directory)
											}
											onDragEnd={actions.endDrag}
											type="button"
											variant="ghost"
											className={cn(
												"h-auto w-full justify-start gap-2.5 rounded-lg px-3 py-2.5 text-left",
												actions.enabled &&
													actions.getFolder(skill.directory) &&
													"cursor-grab active:cursor-grabbing",
												selected &&
													"bg-secondary text-secondary-foreground",
											)}
											disabled={saving || (editing && hasChanges)}
											onClick={() => setSelectedSkillId(skill.id)}
											aria-pressed={selected}
											data-testid={`micro-app-skill-workspace-item-${skill.id}`}
										>
											<span
												className={cn(
													"mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary",
													selected && "bg-primary/15",
												)}
											>
												<BookOpen className="size-3.5" aria-hidden />
											</span>
											<span className="min-w-0 flex-1">
												<span className="block truncate text-sm font-medium leading-5">
													{skill.name}
												</span>
												<span
													className={cn(
														"mt-0.5 block truncate text-xs leading-4 text-muted-foreground",
														skill.description &&
															"line-clamp-2 whitespace-normal",
													)}
												>
													{skill.description ||
														t("microAppPage.skills.noDescription")}
												</span>
											</span>
										</Button>
									)
								})}
							</div>
						) : (
							<div className="flex min-h-32 flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted-foreground">
								{t("microAppPage.skills.empty")}
								{createButton}
							</div>
						)}
					</ScrollArea>
				</aside>

				<section className="min-h-0 min-w-0 flex-1 overflow-hidden" aria-live="polite">
					{selectedSkill ? (
						<div className="flex h-full min-h-0 flex-col">
							<div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-4">
								<div className="min-w-0">
									<div className="flex items-center gap-2 text-xs text-muted-foreground">
										<FileText className="size-3.5" aria-hidden />
										<span>SKILL.md</span>
									</div>
									<h2 className="mt-1 text-base font-semibold leading-6 text-foreground">
										{selectedSkill.name}
									</h2>
									{selectedSkill.description ? (
										<p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
											{selectedSkill.description}
										</p>
									) : null}
								</div>
								<div className="flex shrink-0 items-center gap-2">
									{actions.enabled ? (
										<Button
											variant="outline"
											size="sm"
											disabled={!actions.getFolder(selectedSkill.directory)}
											onClick={() =>
												actions.addToConversation(selectedSkill.directory)
											}
										>
											<MessageSquarePlus className="size-4" aria-hidden />
											{t("microAppPage.skills.addToConversation")}
										</Button>
									) : null}
									{editing ? (
										<>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												disabled={saving}
												onClick={() => {
													setDraftContent(selectedSkill.content)
													setEditing(false)
												}}
											>
												<X className="mr-1 size-4" aria-hidden />
												{t("microAppPage.skills.cancel")}
											</Button>
											<Button
												type="button"
												size="sm"
												disabled={saving || !hasChanges}
												onClick={() => void handleSave()}
											>
												<Save className="mr-1 size-4" aria-hidden />
												{saving
													? t("microAppPage.skills.saving")
													: t("microAppPage.skills.save")}
											</Button>
										</>
									) : canEdit ? (
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => {
												setDraftContent(selectedSkill.content)
												setEditing(true)
											}}
										>
											<Pencil className="mr-1 size-4" aria-hidden />
											{t("microAppPage.skills.edit")}
										</Button>
									) : null}
								</div>
							</div>
							<div
								className="min-h-0 flex-1 overflow-hidden"
								data-testid="micro-app-skill-content"
							>
								{editing ? (
									<EditorBody
										isLoading={false}
										viewMode="markdown"
										language="markdown"
										content={draftContent}
										isEditMode
										editContent={draftContent}
										setEditContent={setDraftContent}
										className="h-full"
									/>
								) : selectedSkill.content ? (
									<MarkdownPreview
										data={{
											file_id: selectedSkill.id,
											file_name: "SKILL.md",
											content: selectedSkill.content,
											relative_file_path: `${selectedSkill.directory}/SKILL.md`,
										}}
										fileContent={selectedSkill.content}
										viewMode="desktop"
										isEditMode={false}
										showFileHeader={false}
										showFooter={false}
										className="h-full overflow-auto"
									/>
								) : (
									<div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
										{t("microAppPage.skills.contentEmpty")}
									</div>
								)}
							</div>
						</div>
					) : (
						<div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
							{t("microAppPage.skills.detailEmpty")}
						</div>
					)}
				</section>
			</div>
		</div>
	)
}
