import { useMessageRenderContext } from "@/opensource/components/business/MessageRenderProvider/hooks"
import { useStyles } from "./styles"
import { cx } from "antd-style"
import { memo } from "react"
interface MagicInlineCodeProps {
	data?: string
	className?: string
}

const MagicInlineCode = memo(function MagicInlineCode(props: MagicInlineCodeProps) {
	const { styles } = useStyles()
	const { hiddenDetail } = useMessageRenderContext()
	const { data: propsValue, className } = props

	// 处理边界情况
	if (!propsValue) {
		return null
	}

	if (hiddenDetail) return propsValue

	return <code className={cx(styles.default, className)}>{propsValue}</code>
})

export default MagicInlineCode
