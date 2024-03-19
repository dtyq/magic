import { memo, useCallback } from "react"
import { Switch } from "@/opensource/components/shadcn-ui/switch"

interface VipSwitchProps {
	checked: boolean
	onChange: (checked: boolean) => void
	disabled?: boolean
}

function useVipSwitchChange(onChange: (checked: boolean) => void) {
	return useCallback(
		(newChecked: boolean) => {
			onChange(newChecked)
		},
		[onChange],
	)
}

/**
 * VIP Switch component
 */
export const VipSwitch = memo(function VipSwitch(props: VipSwitchProps) {
	const { checked, onChange, disabled = false } = props
	const handleChange = useVipSwitchChange(onChange)

	return <Switch checked={checked} onCheckedChange={handleChange} disabled={disabled} />
})

/**
 * VIP Badge component
 */
export const VipBadge = memo(function VipBadge() {
	return null
})
