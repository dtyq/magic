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
	onOpenDetail?: (skill: UserSkillView) => void
	onMoreClick?: (skill: UserSkillView) => void
}

function MySkillCardMobile({
	skill,
	cardVariant,
	onOpenDetail,
	onMoreClick,
}: MySkillCardMobileProps) {
	const { t } = useTranslation("crew/market")
	const { displayDescription, displayName, footerLabel, latestVersion, packageName } =
		getMySkillCardCopy({
			skill,
			cardVariant,
			t,
		})

	function handleMoreClick(event: React.MouseEvent<HTMLButtonElement>) {
		event.preventDefault()
		event.stopPropagation()
		onMoreClick?.(skill)
	}

	function handleOpenDetail() {
		onOpenDetail?.(skill)
	}

	const content = (
		<div
			role={onOpenDetail ? "button" : undefined}
			tabIndex={onOpenDetail ? 0 : undefined}
			className={cn(
				"flex min-w-0 flex-col gap-1.5 rounded-md border border-border bg-popover p-2.5 shadow-sm",
				onOpenDetail &&
					"cursor-pointer transition-colors hover:border-primary/40 hover:bg-accent/40",
			)}
			onClick={onOpenDetail ? handleOpenDetail : undefined}
			onKeyDown={
				onOpenDetail
					? (event) => {
							if (event.key !== "Enter" && event.key !== " ") return
							event.preventDefault()
							handleOpenDetail()
						}
					: undefined
			}
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
						cardVariant={cardVariant}
						packageName={packageName}
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

	return content
}

export default memo(MySkillCardMobile)
