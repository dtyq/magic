import type { ComponentProps } from "react"
import { useTranslation } from "react-i18next"

import { MobileSettingsSheetContainer } from "./SheetContainer"

/**
 * 默认订单记录内容保留同形态容器，避免共享渲染层额外分支。
 */
export default function MobileSettingsOrderHistoryUnavailable(
	props: Pick<ComponentProps<typeof MobileSettingsSheetContainer>, "open"> & {
		onClose: () => void
	},
) {
	const { open, onClose } = props
	const { t } = useTranslation("interface")

	return (
		<MobileSettingsSheetContainer
			open={open}
			title={t("setting.orderRecords")}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose()
			}}
			dataTestId="mobile-settings-order-history-unavailable-sheet"
		>
			<div className="flex min-h-[240px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
				{t("setting.comingSoon")}
			</div>
		</MobileSettingsSheetContainer>
	)
}
