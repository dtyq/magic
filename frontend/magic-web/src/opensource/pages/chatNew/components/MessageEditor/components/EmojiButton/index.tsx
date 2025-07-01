import type { MagicButtonProps } from "@/opensource/components/base/MagicButton"
import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IMStyle } from "@/opensource/providers/AppearanceProvider/context"
import { IconMoodHappy } from "@tabler/icons-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Popover } from "antd"
import MagicEmojiPanel from "@/opensource/components/base/MagicEmojiPanel"
import type { EmojiInfo } from "@/opensource/components/base/MagicEmojiPanel/types"

interface EmojiButtonProps extends Omit<MagicButtonProps, "onClick"> {
	iconSize?: number
	imStyle?: IMStyle
	onEmojiClick?: (emoji: EmojiInfo) => void
}

function EmojiButton({
	iconSize = 20,
	imStyle,
	onEmojiClick,
	className,
	...props
}: EmojiButtonProps) {
	const { t } = useTranslation("interface")

	const isStandard = useMemo(() => imStyle === IMStyle.Standard, [imStyle])

	return (
		<Popover
			content={<MagicEmojiPanel onClick={onEmojiClick} />}
			trigger="click"
			styles={{
				body: {
					padding: 0,
				},
			}}
		>
			<MagicButton
				type="text"
				icon={<MagicIcon color="currentColor" size={iconSize} component={IconMoodHappy} />}
				className={className}
				{...props}
			>
				{isStandard ? t("chat.input.emoji") : undefined}
			</MagicButton>
		</Popover>
	)
}

export default EmojiButton
