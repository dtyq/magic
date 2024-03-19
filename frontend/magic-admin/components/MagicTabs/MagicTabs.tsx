import { Tabs, type TabsProps } from "antd"
import { memo } from "react"
import { useStyles } from "./style"

export type MagicTabsProps = TabsProps

const MagicTabs = memo(({ className, ...props }: MagicTabsProps) => {
	const { styles, cx } = useStyles()
	return <Tabs className={cx(styles.magicTabs, className)} {...props} />
})

export default MagicTabs
