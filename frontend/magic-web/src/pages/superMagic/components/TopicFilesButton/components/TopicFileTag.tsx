import { useProjectFileHelp } from "../hooks/useProjectFileHelp"
import { lazy, type ReactNode } from "react"
import {
	ArrowDownToLine,
	Blocks,
	BookOpen,
	CodeXml,
	FileText,
	FlaskConical,
	Image,
	Lightbulb,
	ListChecks,
	PanelsTopLeft,
	Puzzle,
	Scale,
	SlidersHorizontal,
	Users,
	type LucideIcon,
} from "lucide-react"
import { useClawFileHelp } from "../../../pages/ClawPlayground/components/ClawFileHelpTag"
import { resolveFilePresentation, type FilePresentation } from "../utils/file-presentation"
import { useUserFileHelp } from "../../UserSpace/useUserFileHelp"
import { ContextHelp } from "@/components/shadcn-composed/context-help"
import { badgeVariants } from "@/components/shadcn-ui/badge"
import { cn } from "@/utils/cn"
import type { AttachmentItem } from "../hooks/types"
import { useSystemFileHelp, type FileHelpPresentation } from "../hooks/useSystemFileHelp"
import { useSkillFileHelp } from "../hooks/useSkillFileHelp"
import type { SkillFileKind } from "../utils/skill-file-structure"
import { type FileHelpContext } from "../utils/magic-system-folder"

const FileHelpBrowser = lazy(() => import("./FileHelpBrowser"))

const SKILL_PURPOSE_ICONS: Record<Exclude<SkillFileKind, "support">, LucideIcon> = {
	library: Blocks,
	skill: Puzzle,
	entry: Puzzle,
	references: BookOpen,
	scripts: CodeXml,
	assets: Image,
	templates: PanelsTopLeft,
	examples: Lightbulb,
	evals: FlaskConical,
	evalCases: ListChecks,
	evalInputs: ArrowDownToLine,
	agents: Users,
	readme: FileText,
	license: Scale,
	publishConfig: SlidersHorizontal,
}

/** 标签只解释用途；点击、键盘和触屏操作不能冒泡为文件打开或目录折叠。 */
export function TopicFileTag({
	label,
	shortLabel,
	help,
	articleId,
	sourceKey,
	fileLocation,
	icon,
}: FileHelpPresentation & { icon?: ReactNode }) {
	// 用途标签点击后直接进入指南；悬浮只显示摘要与点击提示，不再要求先经过预览卡片。
	return (
		<ContextHelp
			help={help}
			mode="dialog"
			renderDialog={
				articleId
					? (props) => (
							<FileHelpBrowser
								key={sourceKey ?? articleId}
								{...props}
								initialArticleId={articleId}
								fileLocation={fileLocation}
							/>
						)
					: undefined
			}
		>
			<button
				type="button"
				aria-label={label}
				data-slot="badge"
				className={cn(
					badgeVariants({ variant: "outline" }),
					"min-h-5 max-w-full cursor-help gap-1 rounded-md border-border bg-background px-2 py-0.5 text-[10px] font-normal leading-3 text-muted-foreground shadow-none transition-none hover:border-foreground/20 hover:bg-accent hover:text-foreground",
				)}
				onPointerDown={(event) => event.stopPropagation()}
				onClick={(event) => event.stopPropagation()}
				onDoubleClick={(event) => event.stopPropagation()}
				onKeyDown={(event) => event.stopPropagation()}
			>
				{icon}
				<span className="min-w-0 whitespace-nowrap text-left">{shortLabel ?? label}</span>
			</button>
		</ContextHelp>
	)
}

export function ProjectFileTag({
	presentation: supplied,
	item,
	skillKind,
	path,
	context,
}: {
	presentation?: FilePresentation
	item: AttachmentItem
	skillKind?: SkillFileKind
	path?: string
	context?: FileHelpContext
}) {
	// Skill 里的同名示例属于资料，不进入项目规则说明。
	const file = supplied ?? resolveFilePresentation(item, { skillKind, path, context })
	const system = useSystemFileHelp(file.systemKind, file)
	const skill = useSkillFileHelp(file.skillKind, file)
	const user = useUserFileHelp(file.userKind, file)
	const claw = useClawFileHelp(file.clawKind, file)
	const project = useProjectFileHelp(file.projectKind, file)
	const presentation = skill ?? user ?? claw ?? system ?? project
	const PurposeIcon =
		skill && file.skillKind && file.skillKind !== "support"
			? SKILL_PURPOSE_ICONS[file.skillKind]
			: undefined
	return presentation ? (
		<TopicFileTag
			{...presentation}
			icon={
				PurposeIcon ? <PurposeIcon size={12} className="shrink-0" aria-hidden /> : undefined
			}
		/>
	) : null
}

export function UserSpaceFileTag({ item }: { item: AttachmentItem }) {
	return <ProjectFileTag item={item} context={{ kind: "user" }} />
}
