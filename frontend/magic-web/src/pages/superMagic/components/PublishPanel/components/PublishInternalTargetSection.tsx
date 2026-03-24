import { useEffect, useMemo } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { usePublishPanelStore } from "../context"
import type { PublishInternalTarget } from "../types"
import PublishTargetOption from "./PublishTargetOption"

const openSourceTargetOrder: PublishInternalTarget[] = ["PRIVATE"]

interface PublishInternalTargetSectionProps {
	disabled?: boolean
}

/**
 * Open-source supports only private internal publishing.
 */
export default observer(function PublishInternalTargetSection({
	disabled = false,
}: PublishInternalTargetSectionProps) {
	const { t } = useTranslation("crew/market")
	const store = usePublishPanelStore()
	const availableInternalTargets = useMemo(
		() => openSourceTargetOrder.filter((item) => store.availableInternalTargets.includes(item)),
		[store.availableInternalTargets],
	)

	useEffect(() => {
		if (store.draft.publishTo !== "INTERNAL") return
		if (availableInternalTargets.length === 0) return
		if (availableInternalTargets.includes(store.draft.internalTarget)) return

		store.selectInternalTarget(availableInternalTargets[0])
	}, [availableInternalTargets, store, store.draft.internalTarget, store.draft.publishTo])

	return (
		<div className="flex flex-col gap-2">
			<p className="flex items-center gap-1 text-base font-medium text-foreground">
				{t("skillEditPage.publishPanel.create.fields.permissionSettings.label")}
				<span className="text-destructive" aria-hidden="true">
					*
				</span>
			</p>
			<div className="flex flex-col gap-2">
				{availableInternalTargets.map((target) => (
					<PublishTargetOption
						key={target}
						target={target}
						selected={store.isInternalTargetSelected(target)}
						onToggle={store.selectInternalTarget}
						disabled={disabled}
					/>
				))}
			</div>
		</div>
	)
})
