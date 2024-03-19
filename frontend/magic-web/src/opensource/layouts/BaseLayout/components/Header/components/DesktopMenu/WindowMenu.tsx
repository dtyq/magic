import { createStyles } from "antd-style"
import { magic } from "@/opensource/enhance/magicElectron"
import { useEffect, useState } from "react"
import { IconX, IconMinus, IconSquares } from "@tabler/icons-react"
import { useDesktopVersionCheck } from "./useDesktopVersionCheck"

export const useStyles = createStyles(({ css }) => {
	return {
		menu: css`
			width: 100px;
			height: 12px;
			display: flex;
			align-items: center;
			justify-content: space-between;
		`,
		menuIcon: css`
			width: 30px;
			height: 30px;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			border-radius: 4px;
			color: rgba(33, 33, 33, 1);

			&:hover {
				background-color: rgba(33, 33, 33, 0.04);
			}
		`,
		maxButton: css`
			&:hover {
				color: #fff;
				background-color: #d53b2b;
			}
		`,
		inactive: css`
			color: rgba(33, 33, 33, 0.4);
		`,
	}
})

export function WindowMenu() {
	const { styles, cx } = useStyles()
	const { isHighVersion } = useDesktopVersionCheck()

	const [isActive, setActive] = useState(false)

	useEffect(() => {
		const onBlur = () => {
			setActive(false)
		}
		const onFocus = () => {
			setActive(true)
		}
		window.addEventListener("focus", onFocus)
		window.addEventListener("blur", onBlur)

		return () => {
			window.removeEventListener("focus", onFocus)
			window.removeEventListener("blur", onBlur)
		}
	}, [])

	if (!(isHighVersion && magic?.env?.isWindows())) {
		return null
	}

	return (
		<div className={cx(styles.menu)}>
			<span
				className={cx(styles.menuIcon, {
					[styles.inactive]: !isActive,
				})}
				onClick={() => magic?.view?.minimize?.()}
			>
				<IconMinus size={20} strokeWidth={1.5} />
			</span>
			<span
				className={cx(styles.menuIcon, {
					[styles.inactive]: !isActive,
				})}
				onClick={() => magic?.view?.maximize?.()}
			>
				<IconSquares size={20} strokeWidth={1.5} />
			</span>
			<span
				className={cx(styles.menuIcon, styles.maxButton, {
					[styles.inactive]: !isActive,
				})}
				onClick={() => magic?.view?.close?.()}
			>
				<IconX size={20} strokeWidth={1.5} />
			</span>
		</div>
	)
}
