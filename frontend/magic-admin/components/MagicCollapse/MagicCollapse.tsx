import type { CollapseProps } from "antd"
import { Collapse } from "antd"
import { memo } from "react"
import { useStyles } from "./style"

export interface MagicCollapseProps extends CollapseProps {}

const MagicCollapse = memo(({ className, ...props }: MagicCollapseProps) => {
	const { styles, cx } = useStyles()

	return <Collapse className={cx(styles.magicCollapse, className)} {...props} />
})

export default MagicCollapse
