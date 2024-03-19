import { memo } from "react"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconWorld } from "@tabler/icons-react"
import { cx } from "antd-style"
import { useStyles } from "./styles"
import { Tooltip } from "antd"

interface BrowserProps {
	url?: string
	className?: string
	style?: React.CSSProperties
}

export default memo(function Browser(props: BrowserProps) {
	const { url, className, style } = props
	const { styles } = useStyles()

	return (
		<div className={cx(styles.header, className)} style={style}>
			<div className={styles.url}>
				<MagicIcon className={styles.icon} component={IconWorld} stroke={2} size={20} />
				<div className={styles.text} title={url}>
					{url}
				</div>
			</div>
		</div>
	)
})
