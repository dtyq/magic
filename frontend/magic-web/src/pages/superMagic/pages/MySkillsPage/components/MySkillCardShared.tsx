import type { ReactNode } from "react"
import { Badge } from "@/components/shadcn-ui/badge"
import type { SkillPublisherType } from "@/apis/modules/skills"
import {
	CollaboratorPermissionEnum,
	type CollaboratorPermission,
} from "@/pages/superMagic/types/collaboration"
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
	packageName: string | null
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
	cardVariant: MySkillCardVariant
	packageName: string | null
	latestVersion: string | null
	t: (key: string, options?: Record<string, unknown>) => string
	testIdPrefix: string
}

interface ResolveMySkillFooterLabelArgs {
	cardVariant: MySkillCardVariant
	updatedAtLabel: string
	creatorName: string
	libraryPublisherName: string
	publisherType: SkillPublisherType | undefined
	t: (key: string, options?: Record<string, unknown>) => string
}

function resolveMySkillFooterLabel({
	cardVariant,
	updatedAtLabel,
	creatorName,
	libraryPublisherName,
	publisherType,
	t,
}: ResolveMySkillFooterLabelArgs) {
	if (cardVariant === "created") return updatedAtLabel

	if (publisherType === "OFFICIAL_BUILTIN") return libraryPublisherName

	return t("mySkills.poweredBy", {
		name: cardVariant === "library" ? libraryPublisherName : creatorName,
	})
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

export function resolveTeamSharedSkillPermissions(userRole?: CollaboratorPermission) {
	if (
		userRole === CollaboratorPermissionEnum.OWNER ||
		userRole === CollaboratorPermissionEnum.MANAGE
	) {
		return {
			canEdit: true,
			canDelete: true,
		}
	}

	if (userRole === CollaboratorPermissionEnum.EDITABLE) {
		return {
			canEdit: true,
			canDelete: false,
		}
	}

	return {
		canEdit: false,
		canDelete: false,
	}
}

function isUpdatedAfterPublished(
	updatedAt?: string | null,
	latestPublishedAt?: string | null,
): boolean {
	if (!updatedAt || !latestPublishedAt) return false

	const updatedAtMs = Date.parse(updatedAt)
	const latestPublishedAtMs = Date.parse(latestPublishedAt)
	const hasValidUpdatedAt = !Number.isNaN(updatedAtMs)
	const hasValidLatestPublishedAt = !Number.isNaN(latestPublishedAtMs)

	if (hasValidUpdatedAt && hasValidLatestPublishedAt) return updatedAtMs > latestPublishedAtMs
	return updatedAt > latestPublishedAt
}

export function getMySkillCardCopy({
	skill,
	cardVariant,
	t,
}: MySkillCardCopyArgs): MySkillCardCopy {
	const displayName = normalizeDisplayText(skill.name) || t("mySkills.untitledSkill")
	const displayDescription =
		normalizeDisplayText(skill.description) || t("mySkills.noDescription")
	const packageName =
		normalizeDisplayText(skill.packageName) || normalizeDisplayText(skill.skillCode)
	const latestVersion = normalizeDisplayText(skill.latestVersion)
	const updatedAtValue = normalizeDisplayText(skill.updatedAt)
	const updatedAtLabel = updatedAtValue
		? t("mySkills.updatedAt", { date: updatedAtValue })
		: t("mySkills.unknownUpdatedAt")
	const creatorName = normalizeDisplayText(skill.creatorName) || t("mySkills.creatorUnknown")
	const libraryPublisherName = resolveMarketInstalledPublisherLabel(
		skill.publisherType,
		skill.publisherName,
		t,
	)
	const resolvedLibraryPublisherName = libraryPublisherName || creatorName
	const footerLabel = resolveMySkillFooterLabel({
		cardVariant,
		updatedAtLabel,
		creatorName,
		libraryPublisherName: resolvedLibraryPublisherName,
		publisherType: skill.publisherType,
		t,
	})

	return {
		displayName,
		displayDescription,
		packageName,
		footerLabel,
		latestVersion,
	}
}

function resolveMarketInstalledPublisherLabel(
	publisherType: SkillPublisherType | string | undefined,
	publisherName: string | undefined,
	t: (key: string, options?: Record<string, unknown>) => string,
) {
	const normalizedPublisherName = normalizeDisplayText(publisherName)
	if (
		normalizedPublisherName &&
		publisherType !== "OFFICIAL" &&
		publisherType !== "OFFICIAL_BUILTIN"
	)
		return normalizedPublisherName

	switch (publisherType) {
		case "OFFICIAL":
			return t("skillsLibrary.official")
		case "OFFICIAL_BUILTIN":
			return t("employeeCard.officialBuiltin")
		case "USER":
			return t("employeeCard.publisherUser")
		case "VERIFIED_CREATOR":
			return t("employeeCard.publisherVerified")
		case "PARTNER":
			return t("employeeCard.publisherPartner")
		default:
			return null
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
	cardVariant,
	packageName,
	latestVersion,
	t,
	testIdPrefix,
}: MySkillCardBadgesProps) {
	const hasPublishedVersion = Boolean(latestVersion)
	const hasUnpublishedChanges =
		cardVariant === "created" &&
		hasPublishedVersion &&
		isUpdatedAfterPublished(skill.updatedAt, skill.latestPublishedAt)
	const packageNameBadge = packageName ? (
		<Badge
			variant="secondary"
			className="min-w-0 max-w-full flex-1 overflow-hidden rounded-md px-2 py-0.5 text-xs font-semibold"
			data-testid={`${testIdPrefix}-package-name-badge`}
		>
			<SmartTooltip
				elementType="span"
				className="block min-w-0 max-w-full truncate text-xs font-semibold leading-4"
				content={packageName}
				sideOffset={4}
			>
				{packageName}
			</SmartTooltip>
		</Badge>
	) : null

	if (!skill.latestPublishedAt) {
		return (
			<div className="flex min-w-0 max-w-full items-center gap-2 overflow-hidden">
				{packageNameBadge}
				{hasUnpublishedChanges ? (
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
				) : (
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
				)}
			</div>
		)
	}

	return (
		<div className="flex min-w-0 max-w-full items-center gap-2 overflow-hidden">
			{packageNameBadge}
			{latestVersion && (
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
			)}
			{hasUnpublishedChanges ? (
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
		</div>
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
