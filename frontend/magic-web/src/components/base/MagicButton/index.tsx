import { colorScales as baseColorScales } from "../../../providers/ThemeProvider/colors"
import type { ButtonProps, ThemeConfig } from "antd"
import { Button, Tooltip } from "antd"
import type { GetAntdTheme } from "antd-style"
import { useTheme, ThemeProvider, createStyles, cx } from "antd-style"
import { forwardRef, memo, useMemo, type CSSProperties, type ReactNode } from "react"

export interface MagicButtonProps extends ButtonProps {
	justify?: CSSProperties["justifyContent"]
	theme?: boolean
	tip?: ReactNode
}

const useStyles = createStyles(
	(
		{ css, prefixCls, token, isDarkMode },
		{ justify }: { justify?: CSSProperties["justifyContent"] },
	) => ({
		magicButton: css`
			display: flex;
			align-items: center;
			justify-content: ${justify};
			gap: 2px;
			box-shadow: none;

			.${prefixCls}-btn-icon {
				display: flex;
				align-items: center;
				justify-content: center;
			}

			--${prefixCls}-button-default-hover-color: ${token.colorText} !important;
			--${prefixCls}-button-default-hover-border-color: ${token.colorBorder} !important;
			--${prefixCls}-button-default-hover-bg: ${token.magicColorUsages.fill[0]} !important;
			--${prefixCls}-button-default-bg: ${
				isDarkMode ? token.magicColorUsages.bg[1] : token.colorWhite
			} !important;
			--${prefixCls}-button-default-color: ${token.colorTextSecondary} !important;
		`,
	}),
)

const MagicButton = memo(
	forwardRef<HTMLButtonElement, MagicButtonProps>(
		(
			{
				tip,
				className,
				justify = "center",
				theme = true,
				hidden,
				...props
			}: MagicButtonProps,
			ref,
		) => {
			const { styles } = useStyles({ justify })

			const { magicColorUsages } = useTheme()

			const themeConfigs = useMemo<ThemeConfig | GetAntdTheme | undefined>(() => {
				return theme
					? (appearence) => ({
							components: {
								Button: {
									colorLink: magicColorUsages.primary.default,
									colorLinkHover: magicColorUsages.primary.hover,
									colorLinkActive: magicColorUsages.primary.active,
									colorPrimary: magicColorUsages.primary.default,
									colorPrimaryHover: magicColorUsages.primary.hover,
									colorPrimaryActive: magicColorUsages.primary.active,
									textHoverBg:
										appearence === "dark"
											? baseColorScales.grey[8]
											: magicColorUsages.primaryLight.default,
								},
							},
						})
					: undefined
			}, [
				magicColorUsages.primary.active,
				magicColorUsages.primary.default,
				magicColorUsages.primary.hover,
				magicColorUsages.primaryLight.default,
				theme,
			])

			if (hidden) {
				return null
			}

			return (
				<ThemeProvider theme={themeConfigs}>
					<Tooltip title={tip}>
						<Button
							ref={ref}
							className={cx(styles.magicButton, className)}
							{...props}
						/>
					</Tooltip>
				</ThemeProvider>
			)
		},
	),
)

export default MagicButton
