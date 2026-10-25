import { memo } from "react"
import type { MouseEvent, ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { CircleAlert, Loader2, Mic } from "lucide-react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import PersonaAvatar from "@/pages/superMagic/pages/PersonaResearch/components/PersonaAvatar"
import { cn } from "@/utils/cn"
import { useToggleWithScrollPreserve } from "../../../../shared/hooks/useToggleWithScrollPreserve"
import DefaultTool from "../Default"
import type { ToolCallViewModel } from "../../types"
import ResearchToolCard, { resolveTone } from "./ResearchToolCard"
import type { ResearchToolTone } from "./ResearchToolCard"
import { useFoldedToolRun } from "@/pages/superMagic/components/MessageList/folded-tool-runs-context"
import type { FoldedToolAttempt } from "@/pages/superMagic/components/MessageList/folded-tool-runs"
import { getPersonaChat, getPersonaChatArguments, isSelfCorrectingError } from "./parse"
import type { PendingPersona, PortraitHint } from "./parse"

interface PersonaChatToolProps {
	toolData: ToolCallViewModel
	loading?: boolean
	classNames?: string
	onClick?: () => void
	onMouseEnter?: (evt: MouseEvent) => void
	onMouseLeave?: (evt: MouseEvent) => void
}

/** 主持人在右、受访者在左，和研究页访谈记录（TranscriptView）的气泡一致，字号缩小一档 */
function Turn({
	side,
	avatar,
	label,
	children,
}: {
	side: "moderator" | "persona"
	avatar: ReactNode
	label: string
	children: ReactNode
}) {
	const isModerator = side === "moderator"
	return (
		<li className={cn("flex gap-2", isModerator ? "flex-row-reverse" : "flex-row")}>
			{avatar}
			<div
				className={cn(
					"flex min-w-0 max-w-[85%] flex-col gap-0.5",
					isModerator && "items-end",
				)}
			>
				<span className="text-[11px] leading-4 text-muted-foreground">{label}</span>
				<div
					className={cn(
						"whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-xs leading-5",
						isModerator
							? "rounded-tr-sm bg-primary text-primary-foreground"
							: "rounded-tl-sm bg-muted text-foreground",
					)}
				>
					{children}
				</div>
			</div>
		</li>
	)
}

function ModeratorAvatar() {
	return (
		<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
			<Mic className="size-3" />
		</span>
	)
}

function Avatar({ id, name, hint }: { id: string; name: string; hint: PortraitHint }) {
	return (
		<PersonaAvatar
			id={id}
			name={name}
			demographics={{ gender: hint.gender, age: hint.age }}
			className="size-6"
		/>
	)
}

/**
 * 小组讨论里有人没回答：保留已回答的内容，失败的人单独一行说明原因。
 * 整次请求被拒时只有 error，没有任何回答。
 */
function tonePersonaChat(baseTone: ResearchToolTone, answered: number): ResearchToolTone {
	return baseTone === "error" && answered > 0 ? "partial" : baseTone
}

/**
 * persona_chat 卡片：头部「人设访谈 · 第 3/5 轮」，展开后是这一轮的问答气泡。
 * 执行中 detail 还没到，问题和受访者来自调用参数，回答位置显示「正在作答」。
 */
function PersonaChatTool({
	toolData,
	loading = false,
	classNames,
	onClick,
	onMouseEnter,
	onMouseLeave,
}: PersonaChatToolProps) {
	const { t } = useTranslation("personaResearch")
	// 默认展开：问答本身就是这张卡片的内容；用户收起后在本条消息内保持收起
	const [open, toggle] = useToggleWithScrollPreserve(true, "persona-chat-expanded")
	// 紧接着的同因失败已从消息流里隐去，由这张卡片汇总显示
	const foldedRun = useFoldedToolRun(toolData.id)
	const data = loading ? null : getPersonaChat(toolData.detail)

	if (foldedRun && !loading) {
		return (
			<FoldedPersonaChat
				toolData={toolData}
				attempts={foldedRun}
				classNames={classNames}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			/>
		)
	}
	const pending = loading ? getPersonaChatArguments(toolData.rawArguments) : null
	const baseTone = resolveTone(loading, toolData.status)

	// 老消息（Markdown detail）或执行中拿不到参数：退回默认卡片
	if (!data && !pending) {
		return (
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

	const question = data?.question || pending?.question || ""
	const round = data?.round_number ?? pending?.round_number
	const roundLabel = round
		? data?.round_limit
			? t("toolCard.roundOf", { round, limit: data.round_limit })
			: t("toolCard.round", { round })
		: null
	const selfCorrecting = data ? isSelfCorrectingError(data.error, data.error_reason) : false
	const tone =
		selfCorrecting && baseTone === "error"
			? "partial"
			: tonePersonaChat(baseTone, data?.answers.length ?? 0)

	return (
		<ResearchToolCard
			toolData={toolData}
			tone={tone}
			classNames={classNames}
			summary={
				roundLabel ? (
					<span className="shrink-0 rounded bg-muted px-1.5 text-[11px] leading-[18px] text-muted-foreground">
						{roundLabel}
					</span>
				) : undefined
			}
			open={open}
			onToggle={toggle}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			{/* 小组讨论 6 人都长篇回答时限制高度，避免把消息流撑得很长 */}
			<ScrollArea
				className="[&_[data-radix-scroll-area-viewport]>div]:!block"
				viewportClassName="max-h-96"
			>
				<ol className="m-0 flex list-none flex-col gap-3 p-3">
					{question && (
						<Turn
							side="moderator"
							avatar={<ModeratorAvatar />}
							label={t("transcript.moderator")}
						>
							{question}
						</Turn>
					)}
					{data?.answers.map((answer) => (
						<Turn
							key={answer.persona_id}
							side="persona"
							avatar={
								<Avatar id={answer.persona_id} name={answer.name} hint={answer} />
							}
							label={answer.name}
						>
							{answer.text}
						</Turn>
					))}
					{data?.failed.map((item) => (
						<li key={item.persona_id} className="flex items-center gap-2 text-xs">
							<span className="opacity-50">
								<Avatar id={item.persona_id} name={item.name} hint={item} />
							</span>
							<span className="shrink-0 text-muted-foreground">{item.name}</span>
							<span className="inline-flex min-w-0 items-center gap-1 text-warning">
								<CircleAlert className="size-3.5 shrink-0" aria-hidden />
								<span className="min-w-0 break-words">
									{t("toolCard.notAnswered")}
									{item.reason ? ` · ${item.reason}` : ""}
								</span>
							</span>
						</li>
					))}
					{data?.error && (
						<li
							className={cn(
								"flex items-start gap-1.5 text-xs",
								selfCorrecting ? "text-warning" : "text-destructive",
							)}
						>
							<CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
							<span className="min-w-0 break-words">{data.error}</span>
						</li>
					)}
					{pending?.personas.map((persona: PendingPersona) => (
						// 执行中只知道档案路径、不知道名字和性别，先用占位头像，避免回答到达后头像突变
						<Turn
							key={persona.persona_id}
							side="persona"
							avatar={<Skeleton className="size-6 shrink-0 rounded-full" />}
							label={t("transcript.respondent")}
						>
							<span className="inline-flex items-center gap-1.5 text-muted-foreground">
								<Loader2
									className="size-3 animate-spin motion-reduce:animate-none"
									aria-hidden
								/>
								{t("toolCard.answering")}
							</span>
						</Turn>
					))}
				</ol>
			</ScrollArea>
		</ResearchToolCard>
	)
}

/**
 * 连续多次同因失败折叠成的一张卡片：「人设访谈 · 有 N 次未执行，AI 已调整」，默认收起，
 * 展开逐条列出每次的问题和原因。AI 会自己修正的失败用琥珀色，真正的失败才用红色。
 */
function FoldedPersonaChat({
	toolData,
	attempts,
	classNames,
	onMouseEnter,
	onMouseLeave,
}: {
	toolData: ToolCallViewModel
	attempts: FoldedToolAttempt[]
	classNames?: string
	onMouseEnter?: (evt: MouseEvent) => void
	onMouseLeave?: (evt: MouseEvent) => void
}) {
	const { t } = useTranslation("personaResearch")
	const [open, toggle] = useToggleWithScrollPreserve(false, "persona-chat-folded-expanded")
	const selfCorrecting = attempts.every((attempt) => isSelfCorrectingError(attempt.error))
	return (
		<ResearchToolCard
			toolData={toolData}
			tone={selfCorrecting ? "partial" : "error"}
			classNames={classNames}
			remark={null}
			summary={
				<span className="min-w-0 truncate text-xs text-muted-foreground">
					{t("toolCard.foldedAttempts", { count: attempts.length })}
				</span>
			}
			open={open}
			onToggle={toggle}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<ScrollArea
				className="[&_[data-radix-scroll-area-viewport]>div]:!block"
				viewportClassName="max-h-72"
			>
				<ol className="m-0 flex list-none flex-col gap-2.5 p-3 text-xs">
					{attempts.map((attempt, index) => (
						<li key={attempt.toolCallId} className="flex flex-col gap-0.5">
							<span className="line-clamp-2 break-words text-muted-foreground">
								{t("toolCard.attempt", { index: index + 1 })}
								{attempt.question ? ` · ${attempt.question}` : ""}
							</span>
							<span
								className={cn(
									"inline-flex items-start gap-1",
									selfCorrecting ? "text-warning" : "text-destructive",
								)}
							>
								<CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
								<span className="min-w-0 break-words">{attempt.error}</span>
							</span>
						</li>
					))}
				</ol>
			</ScrollArea>
		</ResearchToolCard>
	)
}

export default memo(PersonaChatTool)
