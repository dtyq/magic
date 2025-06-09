import { createStyles } from "antd-style"
import { observer } from "mobx-react-lite"
import AiCompletionTipStore from "@/opensource/stores/chatNew/editor/AiCompletionTip"
import image from "./ai-completion-tip.svg"
import { useMemo } from "react"

const useStyles = createStyles(({ token }) => ({
	tip: {
		position: "fixed",
		top: 0,
		left: 0,
		zIndex: 1,
		backgroundColor: token.magicColorUsages.bg[1],
		height: 20,
		borderRadius: 4,
	},
}))

const FooterHeight = 50

const AiCompletionTip = observer(() => {
	const { styles } = useStyles()

	const { visible, position } = AiCompletionTipStore

	const divStyles = useMemo(() => {
		const visibleHeight = window.innerHeight - FooterHeight
		const divTop = position.top + 4

		const isVisible =
			visible && divTop < visibleHeight && position.top !== 0 && position.left !== 0

		return {
			top: position.top + 4,
			left: position.left,
			display: isVisible ? "block" : "none",
			zIndex: 1,
		}
	}, [position.left, position.top, visible])

	return (
		<div className={styles.tip} style={divStyles}>
			<img src={image} alt="ai-completion-tip" />
		</div>
	)
})

export default AiCompletionTip
