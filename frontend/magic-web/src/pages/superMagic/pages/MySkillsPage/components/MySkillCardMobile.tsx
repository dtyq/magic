import { memo } from "react"
import { Ellipsis } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Separator } from "@/components/shadcn-ui/separator"
import { cn } from "@/lib/utils"
import type { UserSkillView } from "@/services/skills/SkillsService"
import {
	getMySkillCardCopy,
	MySkillCardBadges,
	MySkillCardFooterLabel,
	MySkillCardInfoSection,
	type MySkillCardVariant,
} from "./MySkillCardShared"

interface MySkillCardMobileProps {
	skill: UserSkillView
	cardVariant: MySkillCardVariant
	href?: string
	onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>) => void
	onMoreClick?: (skill: UserSkillView) => void
}

function MySkillCardMobile({
	skill,
	cardVariant,
	href,
	onNavigate,
	onMoreClick,
}: MySkillCardMobileProps) {
	const { t } = useTranslation("crew/market")
	const { displayDescription, displayName, footerLabel, latestVersion } = getMySkillCardCopy({
		skill,
		cardVariant,
		t,
	})

	function handleMoreClick(event: React.MouseEvent<HTMLButtonElement>) {
		event.preventDefault()
		event.stopPropagation()
		onMoreClick?.(skill)
	}

	const content = (
		<div
			className="flex min-w-0 flex-col gap-1.5 rounded-md border border-border bg-popover p-2.5 shadow-sm"
			data-testid="my-skill-card-mobile"
		>
			<MySkillCardInfoSection
				skill={skill}
				displayName={displayName}
				displayDescription={displayDescription}
				iconSize={36}
				thumbnailClassName="size-9 rounded-lg"
				rootClassName="flex min-w-0 items-start gap-2"
				contentClassName="flex min-w-0 flex-1 flex-col gap-2"
				titleRowClassName="flex min-w-0 items-start justify-between gap-2"
				titleClassName="min-w-0 flex-1 pt-0.5 text-sm font-medium leading-6 text-foreground"
				descriptionClassName="text-xs leading-4 text-muted-foreground"
				testIdPrefix="my-skill-card-mobile"
				titleTrailing={
					<MySkillCardBadges
						skill={skill}
						latestVersion={latestVersion}
						t={t}
						testIdPrefix="my-skill-card-mobile"
					/>
				}
			/>
			<Separator />
			<div className="flex min-h-6 items-center gap-2">
				<MySkillCardFooterLabel
					footerLabel={footerLabel}
					className="min-w-0 flex-1 text-xs leading-4 text-muted-foreground"
					testId="my-skill-card-mobile-footer-label"
				/>
				{onMoreClick ? (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-6 shrink-0 rounded-md"
						onClick={handleMoreClick}
						aria-label={t("mySkills.moreActionsAria")}
						data-testid="my-skill-card-mobile-more-trigger"
					>
						<Ellipsis className="size-4" aria-hidden />
					</Button>
				) : null}
			</div>
		</div>
	)

	if (!href) return content

	return (
		<a
			href={href}
			onClick={onNavigate}
			className={cn("block text-current no-underline")}
			data-testid="my-skill-card-mobile-link"
		>
			{content}
		</a>
	)
}

export default memo(MySkillCardMobile)
