import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { useEffect, useMemo, useState } from "react"
import { BookOpen, Loader2, Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { Button } from "@/components/shadcn-ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { cn } from "@/utils/cn"

import {
	getSkillFiles,
	loadProjectSkills,
	type ProjectSkill,
} from "@/pages/superMagic/components/microAppSkills"

interface MicroAppSkillsPanelProps {
	attachmentList: AttachmentItem[]
	microAppId: string
	microAppName?: string
}

export default function MicroAppSkillsPanel({
	attachmentList,
	microAppId,
	microAppName,
}: MicroAppSkillsPanelProps) {
	const fileApi = useFileApi()
	const { t, i18n } = useTranslation("super")
	const [open, setOpen] = useState(false)
	const [skills, setSkills] = useState<ProjectSkill[]>([])
	const [loading, setLoading] = useState(false)
	const [loadFailed, setLoadFailed] = useState(false)
	const language = i18n?.resolvedLanguage ?? i18n?.language ?? "zh_CN"
	const skillFiles = useMemo(() => getSkillFiles(attachmentList), [attachmentList])

	useEffect(() => {
		if (!open) return
		if (!skillFiles.length) {
			setSkills([])
			setLoading(false)
			setLoadFailed(false)
			return
		}

		let active = true
		setLoading(true)
		setLoadFailed(false)
		void loadProjectSkills(attachmentList, language, fileApi)
			.then((nextSkills) => {
				if (!active) return
				setSkills(nextSkills)
			})
			.catch(() => {
				if (active) setLoadFailed(true)
			})
			.finally(() => {
				if (active) setLoading(false)
			})

		return () => {
			active = false
		}
	}, [attachmentList, fileApi, language, open, skillFiles])

	function handleUse(skill: ProjectSkill) {
		const content: JSONContent = {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{
							type: "mention",
							attrs: {
								type: MentionItemType.MICRO_APP,
								data: {
									app_id: microAppId,
									app_name:
										microAppName?.trim() ||
										t("microAppPage.conversation.defaultAppName"),
								},
							},
						},
						{
							type: "text",
							text: t("microAppPage.skills.usePrompt", { skill: skill.name }),
						},
					],
				},
			],
		}
		pubsub.publish(PubSubEvents.Append_Suggestion_To_Editor, content)
		setOpen(false)
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 gap-1.5 px-2.5"
					aria-label={t("microAppPage.skills.trigger")}
					data-testid="micro-app-skills-trigger"
				>
					<Sparkles className="size-3.5" aria-hidden />
					{t("microAppPage.skills.trigger")}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				side="bottom"
				sideOffset={8}
				className="w-[400px] max-w-[calc(100vw-24px)] overflow-hidden p-0"
				data-testid="micro-app-skills-popover"
			>
				<div className="border-b border-border px-4 py-3">
					<p className="text-sm font-semibold text-foreground">
						{t("microAppPage.skills.title")}
					</p>
					<p className="mt-0.5 text-xs text-muted-foreground">
						{t("microAppPage.skills.subtitle")}
					</p>
				</div>
				{/* Cap the actual viewport while keeping short and empty skill lists content-sized. */}
				<ScrollArea viewportClassName="h-auto max-h-[430px] p-2 [&>div]:!block">
					{loading ? (
						<div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="size-4 animate-spin" aria-hidden />
							{t("microAppPage.skills.loading")}
						</div>
					) : loadFailed ? (
						<div className="flex min-h-32 items-center justify-center px-6 text-center text-sm text-muted-foreground">
							{t("microAppPage.skills.loadFailed")}
						</div>
					) : skills.length ? (
						<div className="space-y-1">
							{skills.map((skill) => (
								<div
									key={skill.id}
									className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted"
									data-testid={`micro-app-skill-${skill.id}`}
								>
									<span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<BookOpen className="size-4" aria-hidden />
									</span>
									<span className="min-w-0 flex-1">
										<span className="block text-sm font-medium leading-5 text-foreground">
											{skill.name}
										</span>
										<span
											className={cn(
												"mt-0.5 block text-xs leading-4 text-muted-foreground",
												skill.description ? "line-clamp-2" : "italic",
											)}
										>
											{skill.description ||
												t("microAppPage.skills.noDescription")}
										</span>
									</span>
									<Button
										type="button"
										variant="secondary"
										size="sm"
										className="h-7 shrink-0 px-2.5 text-xs"
										onClick={() => handleUse(skill)}
										data-testid={`micro-app-skill-use-${skill.id}`}
									>
										{t("microAppPage.skills.use")}
									</Button>
								</div>
							))}
						</div>
					) : (
						<div className="flex min-h-32 items-center justify-center px-6 text-center text-sm text-muted-foreground">
							{t("microAppPage.skills.empty")}
						</div>
					)}
				</ScrollArea>
			</PopoverContent>
		</Popover>
	)
}
