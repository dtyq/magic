import { useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import {
	EXPIRY_OPTIONS,
	type ShareExpiryFieldProps,
} from "@/pages/superMagic/components/Share/ShareFields/types"

/** Mobile publishing uses a sheet without changing other shared expiry selectors. */
export default function MicroAppMobileExpiryField({ value, onChange }: ShareExpiryFieldProps) {
	const { t } = useTranslation("super")
	const [open, setOpen] = useState(false)
	const labels: Record<string, string> = {
		permanent: t("share.expiryPermanent"),
		180: t("share.expiry180Days"),
		90: t("share.expiry90Days"),
		60: t("share.expiry60Days"),
		30: t("share.expiry30Days"),
		15: t("share.expiry15Days"),
		7: t("share.expiry7Days"),
		3: t("share.expiry3Days"),
		1: t("share.expiry1Day"),
	}
	return (
		<div className="flex flex-col gap-2">
			<label htmlFor="micro-app-expiry" className="text-sm font-medium">
				{t("share.shareExpiry")}
			</label>
			<Button
				id="micro-app-expiry"
				variant="outline"
				className="h-11 w-full justify-between font-normal"
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={() => setOpen(true)}
			>
				{labels[value ?? "permanent"] ?? labels.permanent}
				<ChevronDown className="size-4 text-muted-foreground" />
			</Button>
			<MagicPopup
				visible={open}
				onClose={() => setOpen(false)}
				title={t("share.shareExpiry")}
				headerVariant="actionHeader"
				headerTitle={t("share.shareExpiry")}
				headerLeadingAction={{
					icon: <X />,
					ariaLabel: t("common.cancel"),
					onClick: () => setOpen(false),
				}}
				bodyClassName="overflow-hidden p-0"
			>
				<ScrollArea viewportClassName="max-h-[50dvh]">
					<div className="p-2" role="group" aria-label={t("share.shareExpiry")}>
						{EXPIRY_OPTIONS.map((option) => (
							<Button
								key={option.value ?? "permanent"}
								variant="ghost"
								className="h-11 w-full justify-between font-normal"
								aria-pressed={option.value === value}
								onClick={() => {
									onChange(option.value)
									setOpen(false)
								}}
							>
								{labels[option.value ?? "permanent"]}
								{option.value === value && <Check className="size-4" />}
							</Button>
						))}
					</div>
				</ScrollArea>
			</MagicPopup>
		</div>
	)
}
