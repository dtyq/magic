import { Button } from "antd"
import { memo } from "react"
import { useTranslation } from "react-i18next"

import { useStyles } from "./style"

export interface BackBottomProps {
	onScrollToBottom: () => void
	visible: boolean
}

const BackBottom = memo<BackBottomProps>(({ visible, onScrollToBottom }: BackBottomProps) => {
	const { styles, cx } = useStyles()

	const { t } = useTranslation("interface")

	return (
		<Button
			className={cx(styles.container, visible && styles.visible)}
			onClick={onScrollToBottom}
		>
			{t("chat.backToBottom")}
		</Button>
	)
})

export default BackBottom
