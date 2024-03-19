import { IconChevronLeft } from "@tabler/icons-react"
import { NavBar, NavBarProps } from "antd-mobile"
import { createStyles } from "antd-style"
import { memo } from "react"

const useStyles = createStyles(({ css, token }) => ({
	header: css`
		&.adm-nav-bar {
			--height: 48px;
			padding: 6px 12px;
			background-color: ${token.magicColorUsages.bg[0]};
			border-bottom: 1px solid ${token.magicColorUsages.border};
			z-index: 100;
		}

		.adm-nav-bar-right {
			display: flex;
			height: 100%;
			align-items: center;
			justify-content: flex-end;
		}

		.adm-nav-bar-back-arrow {
			display: flex;
			align-items: center;
			justify-content: center;
		}
	`,
	arrow: css`
		color: ${token.magicColorUsages.text[1]};
	`,
}))

const MagicNavBar = memo(
	({ onBack, right, children, className, backIcon, ...props }: NavBarProps) => {
		const { styles, cx } = useStyles()

		return (
			<>
				<NavBar
					onBack={onBack}
					className={cx(styles.header, className)}
					right={right}
					backIcon={backIcon || <IconChevronLeft size={24} className={styles.arrow} />}
					{...props}
				>
					{children}
				</NavBar>
			</>
		)
	},
)

export default MagicNavBar
