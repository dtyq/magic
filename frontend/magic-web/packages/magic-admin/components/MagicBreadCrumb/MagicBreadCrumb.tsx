import type { BreadcrumbProps } from "antd"
import { Breadcrumb } from "antd"
import { memo, useMemo } from "react"
import { useStyles } from "./style"

export type MagicBreadCrumbProps = BreadcrumbProps

const MagicBreadCrumb = memo((props: MagicBreadCrumbProps) => {
	const { styles, cx } = useStyles()
	const { className } = props

	const newItems = useMemo(() => {
		return props.items?.map((item) => {
			return {
				...item,
				title: item.onClick ? (
					<span className={cx({ [styles.clickable]: !!item.onClick })}>{item.title}</span>
				) : (
					item.title
				),
			}
		})
	}, [props.items, cx, styles.clickable])

	return (
		<Breadcrumb
			separator=">"
			className={cx(styles.magicBreadCrumb, className)}
			items={newItems}
		/>
	)
})

export default MagicBreadCrumb
