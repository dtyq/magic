import { createStyles } from "antd-style"
import { magic } from "@/enhance/magicElectron"
import { useEffect, useState } from "react"
import { IconMinus } from "@tabler/icons-react"
import { IconClose, IconToggle } from "@/enhance/tabler/icons-react"
import { useDesktopVersionCheck } from "./useDesktopVersionCheck"

export const useStyles = createStyles(({ css }) => {
	return {
		menu: css`
			width: 60px;
			height: 12px;
			display: flex;
			align-items: center;
			justify-content: flex-start;
			gap: 8px;

			svg {
				opacity: 0;
			}

			&:hover {
				& svg {
					opacity: 1;
				}
			}
		`,
		menuIcon: css`
			width: 12px;
			height: 12px;
			border-radius: 50%;
			display: inline-flex;
			align-items: center;
			justify-content: center;
		`,
		closeButton: css`
			background-color: #ff5f57;
		`,
		minButton: css`
			background-color: #febc2e;
		`,
		maxButton: css`
			background-color: #28c840;
		`,
		inactive: css`
			background-color: rgba(33, 33, 33, 0.1);
		`,
	}
})

interface MacMenuProps {
	className?: string
}

export function MacMenu(props?: MacMenuProps) {
	const { styles, cx } = useStyles()
	const { isHighVersion } = useDesktopVersionCheck()

	const [isActive, setActive] = useState(true)

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

	if (!(isHighVersion && magic?.env?.isMacOS())) {
		return null
	}

	return (
		<div className={cx(styles.menu, props?.className)}>
			<span
				className={cx(styles.menuIcon, styles.closeButton, {
					[styles.inactive]: !isActive,
				})}
				onClick={() => magic?.view?.close?.()}
			>
				<IconClose size={8} />
			</span>
			<span
				className={cx(styles.menuIcon, styles.minButton, {
					[styles.inactive]: !isActive,
				})}
				onClick={() => magic?.view?.minimize?.()}
			>
				<IconMinus size={8} />
			</span>
			<span
				className={cx(styles.menuIcon, styles.maxButton, {
					[styles.inactive]: !isActive,
				})}
				onClick={() => magic?.view?.maximize?.()}
			>
				<IconToggle size={6} />
			</span>
		</div>
	)
}
