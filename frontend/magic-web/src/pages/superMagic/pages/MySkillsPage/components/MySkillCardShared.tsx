import type { ReactNode } from "react"
import { Badge } from "@/components/shadcn-ui/badge"
import SmartTooltip from "@/components/other/SmartTooltip"
import { cn } from "@/lib/utils"
import { SkillThumbnail } from "@/pages/superMagic/components/SkillThumbnail"
import type { UserSkillView } from "@/services/skills/SkillsService"

export type MySkillCardVariant = "created" | "team" | "library"

interface MySkillCardCopyArgs {
	skill: UserSkillView
	cardVariant: MySkillCardVariant
	t: (key: string, options?: Record<string, unknown>) => string
}

interface MySkillCardCopy {
	displayName: string
	displayDescription: string
	footerLabel: string
	latestVersion: string | null
}

interface MySkillCardInfoSectionProps {
	skill: UserSkillView
	displayName: string
	displayDescription: string
	iconSize: number
	thumbnailClassName: string
	rootClassName: string
	contentClassName: string
	titleRowClassName: string
	titleClassName: string
	descriptionClassName: string
	testIdPrefix: string
	titleTrailing?: ReactNode
	belowTitle?: ReactNode
}

interface MySkillCardBadgesProps {
	skill: UserSkillView
	latestVersion: string | null
	t: (key: string, options?: Record<string, unknown>) => string
	testIdPrefix: string
}

interface MySkillCardFooterLabelProps {
	footerLabel: string
	className: string
	testId: string
}

export function normalizeDisplayText(value?: string | null) {
	const normalizedValue = value?.trim()
	if (!normalizedValue) return null
	return normalizedValue
}

export function getMySkillCardCopy({
	skill,
	cardVariant,
	t,
}: MySkillCardCopyArgs): MySkillCardCopy {
	const displayName = normalizeDisplayText(skill.name) || t("mySkills.untitledSkill")
	const displayDescription =
		normalizeDisplayText(skill.description) || t("mySkills.noDescription")
	const latestVersion = normalizeDisplayText(skill.latestVersion)
	const updatedAtValue = normalizeDisplayText(skill.updatedAt)
	const updatedAtLabel = updatedAtValue
		? t("mySkills.updatedAt", { date: updatedAtValue })
		: t("mySkills.unknownUpdatedAt")
	const creatorName = normalizeDisplayText(skill.creatorName) || t("mySkills.creatorUnknown")
	const footerLabel =
		cardVariant === "created" ? updatedAtLabel : t("mySkills.poweredBy", { name: creatorName })

	return {
		displayName,
		displayDescription,
		footerLabel,
		latestVersion,
	}
}

export function MySkillCardInfoSection({
	skill,
	displayName,
	displayDescription,
	iconSize,
	thumbnailClassName,
	rootClassName,
	contentClassName,
	titleRowClassName,
	titleClassName,
	descriptionClassName,
	testIdPrefix,
	titleTrailing,
	belowTitle,
}: MySkillCardInfoSectionProps) {
	return (
		<div className={rootClassName}>
			<SkillThumbnail
				src={skill.thumbnail}
				alt={displayName}
				resetKey={skill.id}
				iconSize={iconSize}
				className={thumbnailClassName}
				data-testid={`${testIdPrefix}-thumbnail`}
			/>
			<div className={contentClassName}>
				<div className={titleRowClassName}>
					<SmartTooltip
						elementType="div"
						className={titleClassName}
						content={displayName}
						sideOffset={4}
					>
						{displayName}
					</SmartTooltip>
					{titleTrailing}
				</div>
				{belowTitle}
				<SmartTooltip
					elementType="div"
					className={descriptionClassName}
					content={displayDescription}
					maxLines={2}
					sideOffset={4}
				>
					{displayDescription}
				</SmartTooltip>
			</div>
		</div>
	)
}

export function MySkillCardBadges({
	skill,
	latestVersion,
	t,
	testIdPrefix,
}: MySkillCardBadgesProps) {
	if (!skill.latestPublishedAt) {
		return (
			<Badge
				variant="outline"
				className="max-w-full shrink-0 rounded-md px-2 py-0.5 text-xs font-normal"
				data-testid={`${testIdPrefix}-unpublished-badge`}
			>
				<SmartTooltip
					elementType="span"
					className="block min-w-0 max-w-full text-xs font-normal leading-4"
					content={t("mySkills.badges.unpublished")}
					sideOffset={4}
				>
					{t("mySkills.badges.unpublished")}
				</SmartTooltip>
			</Badge>
		)
	}

	return (
		<>
			<Badge
				variant="outline"
				className="max-w-full shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold"
				data-testid={`${testIdPrefix}-version-badge`}
			>
				<SmartTooltip
					elementType="span"
					className="block min-w-0 max-w-full text-xs font-semibold leading-4"
					content={latestVersion}
					sideOffset={4}
				>
					{latestVersion}
				</SmartTooltip>
			</Badge>
			{skill.needUpgrade ? (
				<Badge
					variant="outline"
					className={cn(
						"max-w-full shrink-0 rounded-md border-transparent bg-amber-50 px-2 py-0.5 text-xs font-normal",
						"text-amber-500 dark:bg-amber-950/30 dark:text-amber-300",
					)}
					data-testid={`${testIdPrefix}-unpublished-changes-badge`}
				>
					<SmartTooltip
						elementType="span"
						className="block min-w-0 max-w-full text-xs font-normal leading-4"
						content={t("skillEditPage.actions.unpublishedChanges")}
						sideOffset={4}
					>
						{t("skillEditPage.actions.unpublishedChanges")}
					</SmartTooltip>
				</Badge>
			) : null}
		</>
	)
}

export function MySkillCardFooterLabel({
	footerLabel,
	className,
	testId,
}: MySkillCardFooterLabelProps) {
	return (
		<SmartTooltip
			elementType="span"
			className={className}
			content={footerLabel}
			sideOffset={4}
			data-testid={testId}
		>
			{footerLabel}
		</SmartTooltip>
	)
}
