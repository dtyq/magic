import { Tag, type TagProps } from "antd"
import MagicIcon from "../MagicIcon"
import { IconX } from "@tabler/icons-react"
import { useStyles } from "./style"

export type MagicTagProps = TagProps

function MagicTag({ className, ...props }: MagicTagProps) {
	const { styles, cx } = useStyles()

	return (
		<Tag
			className={cx(styles.tag, className)}
			closeIcon={<MagicIcon component={IconX} size={16} stroke={2} />}
			{...props}
		/>
	)
}

export default MagicTag
