import { useTranslation } from "react-i18next"
import { CapabilityCard } from "@magic-admin-v2/features/platform-system-capabilities/components/capability-card"
import type { AiPower } from "@magic-admin-v2/features/platform-system-capabilities/types"

export function CapabilityCardList({
	canEdit,
	cardTestId,
	configButtonTestId,
	items,
	listTestId,
	onConfig,
	onStatusChange,
	statusPendingIds,
	statusSwitchTestId,
}: {
	canEdit: boolean
	cardTestId?: string
	configButtonTestId?: string
	items: AiPower[]
	listTestId?: string
	onConfig: (item: AiPower) => void
	onStatusChange: (item: AiPower, checked: boolean) => void
	statusPendingIds: ReadonlySet<string>
	statusSwitchTestId?: string
}) {
	const { t } = useTranslation()

	return (
		<div className="space-y-3" data-testid={listTestId}>
			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{items.map((item) => (
					<CapabilityCard
						cardTestId={cardTestId}
						canEdit={canEdit}
						configButtonTestId={configButtonTestId}
						item={item}
						key={item.id}
						onConfig={onConfig}
						onStatusChange={onStatusChange}
						statusPending={statusPendingIds.has(item.code)}
						statusSwitchTestId={statusSwitchTestId}
					/>
				))}
			</div>
			<div className="px-1 text-sm text-muted-foreground">
				{t("systemCapabilities.list.count", { count: items.length })}
			</div>
		</div>
	)
}
