import MagicPopup from "@/components/base-mobile/MagicPopup"
import { IconX } from "@tabler/icons-react"
import { Check } from "lucide-react"
import { memo } from "react"

import type { MobileDeleteConfirmPopupProps } from "./types"

/**
 * Shared mobile bottom sheet for destructive delete confirmation.
 * Matches project-detail delete UX: X cancel, centered title, red confirm check.
 */
function MobileDeleteConfirmPopup({
	visible,
	onClose,
	title,
	entityName,
	descriptionSuffix,
	onConfirm,
	confirmDisabled = false,
	testIdPrefix = "mobile-delete-confirm",
	cancelAriaLabel,
	confirmAriaLabel,
}: MobileDeleteConfirmPopupProps) {
	return (
		<MagicPopup
			visible={visible}
			onClose={onClose}
			position="bottom"
			title={title}
			headerVariant="actionHeader"
			headerTitle={title}
			headerLeadingAction={{
				icon: <IconX />,
				ariaLabel: cancelAriaLabel,
				onClick: onClose,
				testId: `${testIdPrefix}-cancel`,
			}}
			headerTrailingAction={{
				icon: <Check />,
				ariaLabel: confirmAriaLabel,
				onClick: () => {
					void onConfirm()
				},
				disabled: confirmDisabled,
				tone: "destructive",
				testId: `${testIdPrefix}-confirm`,
			}}
			bodyClassName="max-h-[80dvh] p-0"
		>
			<div className="scrollbar-y-thin flex min-h-0 flex-col overflow-y-auto px-6 pb-[max(var(--safe-area-inset-bottom),48px)] pt-6">
				{/* Bold entity name + muted consequence mirrors project-detail delete hierarchy. */}
				<p
					className="mx-auto max-w-[680px] text-left text-[16px] leading-6"
					data-testid={`${testIdPrefix}-message`}
				>
					<span className="font-semibold text-foreground">{entityName}</span>
					<span className="text-muted-foreground"> {descriptionSuffix}</span>
				</p>
			</div>
		</MagicPopup>
	)
}

export default memo(MobileDeleteConfirmPopup)
export type { MobileDeleteConfirmPopupProps } from "./types"
