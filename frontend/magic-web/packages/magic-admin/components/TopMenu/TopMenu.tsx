import { memo, useEffect, useState } from "react"
import { useStyles } from "./style"

/* 顶部菜单项 */
export interface TopMenuProps {
	items: {
		key: string
		label: string
		icon: React.ReactNode
		hidden?: boolean
	}[]
	pathname: string
	navigate: (key: string) => void
}

/**
 * 顶部菜单
 * @param items
 * @returns
 */
const TopMenu = memo(({ items, pathname, navigate }: TopMenuProps) => {
	const { styles, cx } = useStyles()

	const [selected, setSelected] = useState<string>(items?.[0]?.key || "")

	useEffect(() => {
		setSelected(pathname)
	}, [pathname])

	const handleNavigate = (key: string) => {
		setSelected(key)
		navigate(key)
	}

	return (
		<div className={styles.menu}>
			{items
				.filter((item) => !item.hidden)
				.map((item) => (
					<div
						key={item.key}
						className={cx(styles.menuItem, {
							[styles.active]: selected.startsWith(item.key),
						})}
						onClick={() => handleNavigate(item.key)}
					>
						{item.icon}
						{item.label}
					</div>
				))}
		</div>
	)
})

export default TopMenu
