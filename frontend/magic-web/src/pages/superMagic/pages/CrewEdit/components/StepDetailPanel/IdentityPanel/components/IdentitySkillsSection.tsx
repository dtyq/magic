import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Plus, X } from "lucide-react"
import { observer } from "mobx-react-lite"
import { cn } from "@/lib/utils"
import { Badge, badgeVariants } from "@/components/shadcn-ui/badge"
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/shadcn-ui/hover-card"
import { useCrewEditStore } from "../../../../context"
import { useMemberDisplay } from "../../../../hooks/useMemberDisplay"
import { CREW_SKILLS_TAB } from "../../../../store"

interface IdentitySkillsSectionProps {
	disabled?: boolean
}

function IdentitySkillsSectionInner({ disabled = false }: IdentitySkillsSectionProps) {
	const store = useCrewEditStore()
	const { skills, layout, identity } = store
	const { t } = useTranslation("crew/create")
	const { skillName } = useMemberDisplay({
		name_i18n: identity.name_i18n,
		role_i18n: identity.role_i18n,
		description_i18n: identity.description_i18n,
		icon: identity.icon,
		prompt: identity.prompt,
		skills: skills.skills,
	})
	const skillsContainerRef = useRef<HTMLDivElement>(null)
	const measureContainerRef = useRef<HTMLDivElement>(null)
	const [containerWidth, setContainerWidth] = useState(0)
	const [visibleSkillCount, setVisibleSkillCount] = useState(skills.skills.length)
	const skillItems = useMemo(
		() =>
			skills.skills.map((skill) => ({
				code: skill.skill_code,
				label: skillName(skill),
			})),
		[skills.skills, skillName],
	)

	useLayoutEffect(() => {
		const container = skillsContainerRef.current
		if (!container) return

		const updateWidth = () => {
			const nextWidth = Math.round(container.getBoundingClientRect().width)
			setContainerWidth((prevWidth) => (prevWidth === nextWidth ? prevWidth : nextWidth))
		}

		updateWidth()

		const observer = new ResizeObserver(updateWidth)
		observer.observe(container)

		return () => observer.disconnect()
	}, [])

	useLayoutEffect(() => {
		const measureContainer = measureContainerRef.current
		if (!measureContainer || skillItems.length === 0) {
			setVisibleSkillCount(skillItems.length)
			return
		}

		const skillElements = Array.from(
			measureContainer.querySelectorAll<HTMLElement>("[data-measure-skill-item]"),
		)
		const summaryElement = measureContainer.querySelector<HTMLElement>(
			"[data-measure-skill-summary]",
		)
		const addButtonElement = measureContainer.querySelector<HTMLElement>(
			"[data-measure-skill-add-button]",
		)

		if (skillElements.length === 0 || !summaryElement || !addButtonElement) {
			setVisibleSkillCount(skillItems.length)
			return
		}

		const getLineCount = (elements: HTMLElement[]) =>
			new Set(elements.map((element) => element.offsetTop)).size

		let nextVisibleCount = skillElements.length

		for (let candidate = skillElements.length; candidate >= 0; candidate -= 1) {
			const hiddenCount = skillElements.length - candidate

			skillElements.forEach((element, index) => {
				element.style.display = index < candidate ? "" : "none"
			})

			if (hiddenCount > 0) {
				summaryElement.style.display = ""
				summaryElement.textContent = `+${hiddenCount}`
			} else {
				summaryElement.style.display = "none"
			}

			const visibleElements =
				hiddenCount > 0
					? [...skillElements.slice(0, candidate), summaryElement, addButtonElement]
					: [...skillElements.slice(0, candidate), addButtonElement]

			if (getLineCount(visibleElements) <= 2) {
				nextVisibleCount = candidate
				break
			}
		}

		setVisibleSkillCount((prevCount) =>
			prevCount === nextVisibleCount ? prevCount : nextVisibleCount,
		)
	}, [containerWidth, skillItems])

	const visibleSkills = skillItems.slice(0, visibleSkillCount)
	const hiddenSkills = skillItems.slice(visibleSkillCount)

	return (
		<div className="relative flex flex-col items-center gap-2.5">
			<p className="w-full text-center font-medium text-foreground" style={{ fontSize: 32 }}>
				{t("card.skills")}
			</p>
			<div ref={skillsContainerRef} className="flex w-full flex-wrap justify-center gap-2">
				{visibleSkills.map((skill) => (
					<Badge
						key={skill.code}
						variant="outline"
						className="group/skill h-5 rounded-md px-2 text-xs font-semibold"
					>
						{skill.label}
						{disabled ? null : (
							<button
								type="button"
								className="ml-1 hidden group-hover/skill:inline-flex"
								onClick={() => skills.removeSkill(skill.code)}
								aria-label={`Remove ${skill.label}`}
							>
								<X className="h-3 w-3" />
							</button>
						)}
					</Badge>
				))}
				{hiddenSkills.length > 0 ? (
					<HoverCard openDelay={120}>
						<HoverCardTrigger asChild>
							<button
								type="button"
								className={cn(
									badgeVariants({ variant: "outline" }),
									"h-5 rounded-md px-2 text-xs font-semibold",
								)}
								data-testid="crew-hidden-skills-button"
							>
								+{hiddenSkills.length}
							</button>
						</HoverCardTrigger>
						<HoverCardContent
							className="flex w-auto max-w-[280px] flex-wrap gap-2 p-3"
							data-testid="crew-hidden-skills-content"
						>
							{hiddenSkills.map((skill) => (
								<Badge
									key={skill.code}
									variant="outline"
									className="h-5 rounded-md px-2 text-xs font-semibold"
								>
									{skill.label}
								</Badge>
							))}
						</HoverCardContent>
					</HoverCard>
				) : null}
				<Badge
					variant="outline"
					className={cn(
						"h-5 rounded-md px-2 text-xs font-normal text-foreground",
						disabled
							? "cursor-default opacity-60"
							: "cursor-pointer hover:bg-accent hover:text-accent-foreground",
					)}
					data-testid="crew-add-skills-button"
					onClick={() => {
						if (disabled) return
						layout.openSkillsPanel(CREW_SKILLS_TAB.MySkills)
					}}
				>
					<Plus className="mr-1 h-3.5 w-3.5" />
					{t("card.addSkills")}
				</Badge>
			</div>
			<div
				ref={measureContainerRef}
				aria-hidden="true"
				className="pointer-events-none invisible absolute -z-10 flex w-full flex-wrap justify-center gap-2"
			>
				{skillItems.map((skill) => (
					<Badge
						key={skill.code}
						variant="outline"
						className="h-5 rounded-md px-2 text-xs font-semibold"
						data-measure-skill-item
					>
						{skill.label}
					</Badge>
				))}
				<button
					type="button"
					className={cn(
						badgeVariants({ variant: "outline" }),
						"h-5 rounded-md px-2 text-xs font-semibold",
					)}
					data-measure-skill-summary
				/>
				<Badge
					variant="outline"
					className="h-5 rounded-md px-2 text-xs font-normal text-foreground"
					data-measure-skill-add-button
				>
					<Plus className="mr-1 h-3.5 w-3.5" />
					{t("card.addSkills")}
				</Badge>
			</div>
		</div>
	)
}

export const IdentitySkillsSection = observer(IdentitySkillsSectionInner)
