import type { ComponentType } from "react"
import { Building2, CircleUserRound, UsersRound } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { usePublishPanelStore } from "../context"
import { getInternalTargetUiKey } from "../publishCopy"
import type { PublishInternalTarget } from "../types"

const targetIconMap = {
	PRIVATE: CircleUserRound,
	MEMBER: UsersRound,
	ORGANIZATION: Building2,
} satisfies Record<PublishInternalTarget, ComponentType<{ className?: string }>>

const openSourceTargets: PublishInternalTarget[] = ["PRIVATE"]

interface ReadonlyInternalTargetSectionProps {
	record: NonNullable<ReturnType<typeof usePublishPanelStore>["selectedHistoryRecord"]>
}

/**
 * Open-source shows only private internal permission details.
 */
export default observer(function ReadonlyInternalTargetSection({
	record,
}: ReadonlyInternalTargetSectionProps) {
	return (
		<div className="flex flex-col gap-2">
			{openSourceTargets.map((target) => (
				<ReadonlyInternalTargetCard
					key={target}
					record={record}
					target={target}
					isSelected={record.internalTarget === target}
				/>
			))}
		</div>
	)
})

const ReadonlyInternalTargetCard = observer(function ReadonlyInternalTargetCard({
	record,
	target,
	isSelected,
}: {
	record: NonNullable<ReturnType<typeof usePublishPanelStore>["selectedHistoryRecord"]>
	target: PublishInternalTarget
	isSelected: boolean
}) {
	const { t } = useTranslation("crew/market")
	const Icon = targetIconMap[target]
	const targetUiKey = getInternalTargetUiKey(target)

	return (
		<div
			className={cn(
				"flex w-full items-start gap-0 overflow-hidden rounded-md border bg-card p-3",
				isSelected ? "border-foreground" : "border-border",
			)}
			data-testid={`skill-publish-detail-target-${targetUiKey}`}
		>
			<div className="flex min-w-0 flex-1 flex-col gap-2.5">
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-1.5 text-sm text-foreground">
						<Icon className="size-4 shrink-0" />
						<span>{t(`skillEditPage.publishPanel.targets.${targetUiKey}.label`)}</span>
					</div>
					<p className="text-xs leading-4 text-muted-foreground">
						{t(`skillEditPage.publishPanel.targets.${targetUiKey}.description`)}
					</p>
				</div>
			</div>
		</div>
	)
})
