import { memo } from "react"
import { useTranslation } from "react-i18next"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import type { ShareExpiryFieldProps } from "./types"
import { EXPIRY_OPTIONS } from "./types"

export default memo(function ShareExpiryField(props: ShareExpiryFieldProps) {
	const { value, onChange } = props
	const { t } = useTranslation("super")

	const currentValue = value === null ? "permanent" : String(value)

	return (
		<div className="flex flex-col gap-2">
			<label className="text-sm font-medium leading-none text-foreground">
				{t("share.shareExpiry")}
			</label>
			<Select
				value={currentValue}
				onValueChange={(val) => {
					onChange(val === "permanent" ? null : Number(val))
				}}
			>
				<SelectTrigger className="h-9 w-full">
					<SelectValue placeholder={t("share.expiryPermanent")} />
				</SelectTrigger>
				<SelectContent className="z-[1500]" style={{ zIndex: 1500 }}>
					{EXPIRY_OPTIONS.map((option) => {
						const optionValue =
							option.value === null ? "permanent" : String(option.value)
						return (
							<SelectItem key={optionValue} value={optionValue}>
								{t(option.label)}
							</SelectItem>
						)
					})}
				</SelectContent>
			</Select>
		</div>
	)
})
