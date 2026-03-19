import MagicButton from "@/components/base/MagicButton"
import MagicIcon from "@/components/base/MagicIcon"
import { IconMessage } from "@tabler/icons-react"
import { Flex } from "antd"
import { cx } from "antd-style"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import useMemberCardButtonsStyles from "./MemberCardButtons.styles"

interface MemberCardButtonsProps {
	showButtons?: boolean
	isNormalPerson?: boolean
	isAi?: boolean
	onChatWith: () => void
	classNames?: {
		button?: string
	}
	className?: string
	vertical?: boolean
}

const MemberCardButtons = observer(function MemberCardButtons({
	showButtons = true,
	onChatWith,
	classNames,
	vertical = true,
	className,
}: MemberCardButtonsProps) {
	const { t } = useTranslation("interface")
	const { styles } = useMemberCardButtonsStyles()

	const isNormalPerson = true
	const isAi = false

	if (!showButtons) return null

	const { button } = classNames ?? {}

	return (
		<Flex vertical={vertical} gap={10} className={className}>
			<MagicButton
				hidden={!isNormalPerson}
				block
				size="large"
				type="default"
				className={cx(styles.button, button)}
				icon={<MagicIcon color="currentColor" component={IconMessage} size={20} />}
				onClick={onChatWith}
			>
				{t("memberCard.sendMessage")}
			</MagicButton>
			<MagicButton
				hidden={!isAi}
				block
				size="large"
				type="default"
				className={cx(styles.button, button)}
				icon={<MagicIcon color="currentColor" component={IconMessage} size={20} />}
				onClick={onChatWith}
			>
				{t("memberCard.sendMessage")}
			</MagicButton>
		</Flex>
	)
})

export default MemberCardButtons
