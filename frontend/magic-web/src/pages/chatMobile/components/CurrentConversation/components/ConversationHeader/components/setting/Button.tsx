import MagicIcon from "@/components/base/MagicIcon"
import { IconDots } from "@tabler/icons-react"
import { memo } from "react"

const SettingButton = memo(({ onClick }: { onClick: () => void }) => {
	return <MagicIcon component={IconDots} onClick={onClick} />
})

export default SettingButton
