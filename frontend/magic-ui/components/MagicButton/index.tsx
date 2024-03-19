import { colorScales as baseColorScales } from "../ThemeProvider/colors"
import type { ButtonProps, ThemeConfig } from "antd"
import { Button, Tooltip } from "antd"
import type { GetAntdTheme } from "antd-style"
import { useTheme, ThemeProvider, cx } from "antd-style"
import { forwardRef, memo, useMemo, type CSSProperties, type ReactNode } from "react"
import { useStyles } from "./style"

export interface MagicButtonProps extends ButtonProps {
	justify?: CSSProperties["justifyContent"]
	theme?: boolean
	tip?: ReactNode
}

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
