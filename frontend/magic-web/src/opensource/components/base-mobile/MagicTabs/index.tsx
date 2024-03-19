import { TabProps, Tabs, TabsProps } from "antd-mobile"
import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, token }) => ({
	tabs: css`
		&& {
			--active-title-color: ${token.magicColorScales.black};
			--title-font-size: 14px;

			.adm-tabs-tab-active {
				font-weight: 500;
			}
		}
	`,
}))

function MagicTabs(props: TabsProps) {
	const { styles, cx } = useStyles()

	return <Tabs {...props} className={cx(styles.tabs, props.className)} />
}

function MagicTabsTab(props: TabProps) {
	const { styles, cx } = useStyles()

	return <Tabs.Tab {...props} className={cx(styles.tabs, props.className)} />
}

MagicTabs.Tab = MagicTabsTab

export default MagicTabs
