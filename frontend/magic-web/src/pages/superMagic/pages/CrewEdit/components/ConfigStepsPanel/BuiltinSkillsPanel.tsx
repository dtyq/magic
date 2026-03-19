import { memo, useMemo } from "react"
import { X, Check, PencilRuler } from "lucide-react"
import { useTranslation } from "react-i18next"
import useSWR from "swr"
import { Button } from "@/components/shadcn-ui/button"
import { Badge } from "@/components/shadcn-ui/badge"
import { Separator } from "@/components/shadcn-ui/separator"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { SuperMagicApi } from "@/apis"

import type { BuiltinToolItem } from "@/apis/modules/superMagic"
import { useCrewEditStore } from "../../context"

const BUILTIN_SKILLS_QUERY_KEY = "/api/v1/super-magic/agents/builtin-tools"

interface FlatBuiltinSkill {
	id: string
	name: string
	key: string
	description: string
}

function BuiltinSkillItem({ skill }: { skill: FlatBuiltinSkill }) {
	const { t } = useTranslation("crew/create")

	return (
		<div className="flex items-start gap-2.5 px-2.5 py-3" data-testid="builtin-skill-item">
			<div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-sidebar-accent">
				<PencilRuler className="size-5 text-foreground" />
			</div>

			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<div className="flex items-center gap-1.5">
					<span className="shrink-0 text-sm font-medium text-foreground">
						{skill.name}
					</span>
					<Badge
						variant="secondary"
						className="h-5 rounded-md px-2 text-xs font-semibold"
					>
						{skill.key}
					</Badge>
				</div>
				<p className="text-xs leading-4 text-muted-foreground">{skill.description}</p>
			</div>

			<Button
				variant="secondary"
				size="sm"
				className="h-9 shrink-0 gap-2 opacity-50"
				disabled
				data-testid="builtin-skill-enable-btn"
			>
				<Check className="size-4" />
				{t("playbook.actions.enable")}
			</Button>
		</div>
	)
}

const BuiltinSkillItemMemo = memo(BuiltinSkillItem)

function flattenTools(
	categories: Awaited<ReturnType<typeof SuperMagicApi.getBuiltInTools>>,
): FlatBuiltinSkill[] {
	if (!categories) return []
	return categories.flatMap((category) =>
		category.tools.map((tool: BuiltinToolItem) => ({
			id: tool.code,
			name: tool.name,
			key: tool.code,
			description: tool.description,
		})),
	)
}

export function useBuiltinSkills() {
	const { i18n } = useTranslation("crew/create")
	const { data: categories, isLoading } = useSWR([BUILTIN_SKILLS_QUERY_KEY, i18n.language], () =>
		SuperMagicApi.getBuiltInTools(),
	)

	const skills = useMemo(() => flattenTools(categories ?? []), [categories])

	return {
		skills,
		isLoading,
	}
}

function BuiltinSkillsPanel() {
	const { t } = useTranslation("crew/create")
	const { layout } = useCrewEditStore()
	const { skills, isLoading } = useBuiltinSkills()

	return (
		<div
			className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background"
			data-testid="builtin-skills-panel"
		>
			{/* Header */}
			<div className="flex shrink-0 flex-col gap-3 px-3.5 pt-3.5">
				<div className="flex items-center gap-2">
					<h2 className="flex-1 truncate text-2xl font-medium leading-8 text-foreground">
						{t("skills.builtinTitle", { count: skills.length })}
					</h2>
					<Button
						variant="ghost"
						size="icon"
						className="size-9 shrink-0"
						onClick={() => layout.closeBuiltinSkills()}
						data-testid="builtin-skills-panel-close"
					>
						<X className="size-5" />
					</Button>
				</div>
				<Separator />
			</div>

			{/* Skills list */}
			<ScrollArea className="min-h-0 flex-1 px-1 pt-2">
				{isLoading ? (
					<div className="flex flex-col gap-1 px-3.5">
						{Array.from({ length: 6 }).map((_, i) => (
							<div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
						))}
					</div>
				) : (
					<div className="flex flex-col px-2.5">
						{skills.map((skill, index) => (
							<div key={skill.id}>
								{index > 0 && <Separator />}
								<BuiltinSkillItemMemo skill={skill} />
							</div>
						))}
					</div>
				)}
			</ScrollArea>
		</div>
	)
}

export default memo(BuiltinSkillsPanel)
