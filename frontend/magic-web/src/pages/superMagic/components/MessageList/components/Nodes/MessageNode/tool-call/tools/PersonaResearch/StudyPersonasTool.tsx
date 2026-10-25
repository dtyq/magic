import { memo } from "react"
import type { MouseEvent } from "react"
import { useTranslation } from "react-i18next"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import PersonaAvatar from "@/pages/superMagic/pages/PersonaResearch/components/PersonaAvatar"
import { cn } from "@/utils/cn"
import { useToggleWithScrollPreserve } from "../../../../shared/hooks/useToggleWithScrollPreserve"
import DefaultTool from "../Default"
import type { ToolCallViewModel } from "../../types"
import ResearchToolCard, { resolveTone } from "./ResearchToolCard"
import { getStudyPersonas, getStudyPersonasArguments } from "./parse"
import type { StudyPersonasData } from "./parse"

interface StudyPersonasToolProps {
	toolData: ToolCallViewModel
	loading?: boolean
	classNames?: string
	onClick?: () => void
	onMouseEnter?: (evt: MouseEvent) => void
	onMouseLeave?: (evt: MouseEvent) => void
}

/** 头部最多叠放的头像数；一次研究最多 12 位人设，其余显示「+N」 */
const MAX_STACKED = 6

/** 叠放头像共用的描边：用卡片底色描一圈，相邻头像之间留出缝隙 */
const STACKED_RING = "ring-2 ring-card"

function AvatarStack({ data }: { data: StudyPersonasData }) {
	const shown = data.personas.slice(0, MAX_STACKED)
	const rest = data.personas.length - shown.length
	return (
		<span className="flex shrink-0 items-center pl-1" aria-hidden>
			{shown.map((persona) => (
				<PersonaAvatar
					key={persona.persona_id}
					id={persona.persona_id}
					name={persona.name}
					demographics={{ gender: persona.gender, age: persona.age }}
					className={cn("-ml-1 size-5", STACKED_RING)}
				/>
			))}
			{rest > 0 && (
				<span
					className={cn(
						"-ml-1 flex size-5 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground",
						STACKED_RING,
					)}
				>
					+{rest}
				</span>
			)}
		</span>
	)
}

/**
 * save_personas 卡片：头部「研究人设 [头像组] 新建 5 · 复用 3」，展开后逐行列出人设、分层和来源。
 * 默认收起：名单在研究页人设面板里有完整视图，对话流里只需要一眼看到「谁、几位」。
 */
function StudyPersonasTool({
	toolData,
	loading = false,
	classNames,
	onClick,
	onMouseEnter,
	onMouseLeave,
}: StudyPersonasToolProps) {
	const { t } = useTranslation("personaResearch")
	const [open, toggle] = useToggleWithScrollPreserve(false, "study-personas-expanded")
	const data = loading ? null : getStudyPersonas(toolData.detail)
	const tone = resolveTone(loading, toolData.status)

	if (loading) {
		// 执行中只知道要保存几位，用占位头像表示人数；名字和头像在保存完成后才确定
		const pending = getStudyPersonasArguments(toolData.rawArguments)
		return (
			<ResearchToolCard
				toolData={toolData}
				tone={tone}
				classNames={classNames}
				summary={
					pending.length > 0 ? (
						<span className="flex shrink-0 items-center pl-1" aria-hidden>
							{pending.slice(0, MAX_STACKED).map((persona) => (
								<Skeleton
									key={persona.persona_id}
									className={cn("-ml-1 size-5 rounded-full", STACKED_RING)}
								/>
							))}
						</span>
					) : undefined
				}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			/>
		)
	}

	if (!data) {
		// 失败时没有名单，显示后端的失败说明；老消息（Markdown detail）退回默认卡片
		return tone === "error" ? (
			<ResearchToolCard
				toolData={toolData}
				tone={tone}
				classNames={classNames}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			/>
		) : (
			<DefaultTool
				toolData={toolData}
				loading={loading}
				classNames={classNames}
				onClick={onClick}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			/>
		)
	}

	return (
		<ResearchToolCard
			toolData={toolData}
			tone={tone}
			classNames={classNames}
			summary={
				<>
					<AvatarStack data={data} />
					<span className="shrink-0 text-muted-foreground">
						{t("toolCard.newAndReused", {
							new: data.new_count,
							reused: data.reused_count,
						})}
					</span>
				</>
			}
			// 头像组和「新建 · 复用」已经说清结果，不再重复后端 remark
			remark={null}
			open={open}
			onToggle={toggle}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			{/* Radix 视口内层默认 display: table，会按最宽一行撑开；改成 block 才能让行内文字截断、右侧标签完整显示 */}
			<ScrollArea
				className="[&_[data-radix-scroll-area-viewport]>div]:!block"
				viewportClassName="max-h-80"
			>
				<ul className="m-0 list-none divide-y divide-border py-0 pl-3 pr-4">
					{data.personas.map((persona) => (
						<li
							key={persona.persona_id}
							className="flex items-center gap-2 py-2 text-xs"
						>
							<PersonaAvatar
								id={persona.persona_id}
								name={persona.name}
								demographics={{ gender: persona.gender, age: persona.age }}
								className="size-7"
							/>
							<div className="min-w-0 flex-1">
								<p className="m-0 truncate text-foreground">{persona.name}</p>
								{persona.tagline && (
									<p className="m-0 truncate text-muted-foreground">
										{persona.tagline}
									</p>
								)}
							</div>
							{persona.segment && (
								<span className="max-w-[40%] shrink-0 truncate rounded bg-muted px-1.5 leading-[18px] text-muted-foreground">
									{persona.segment}
								</span>
							)}
							<span
								className={cn(
									"shrink-0 rounded px-1.5 leading-[18px]",
									persona.reused
										? "bg-muted text-muted-foreground"
										: "bg-primary/10 text-primary",
								)}
							>
								{persona.reused
									? t("toolCard.sourceReused")
									: t("toolCard.sourceNew")}
							</span>
						</li>
					))}
				</ul>
			</ScrollArea>
		</ResearchToolCard>
	)
}

export default memo(StudyPersonasTool)
