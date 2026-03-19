import { useIsMobile } from "@/hooks/useIsMobile"
import { Flex } from "antd"
import { createStyles } from "antd-style"
import { memo, useMemo, type ReactNode } from "react"

const useSettingItemStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		container: css`
			padding: 12px 20px;
			&:not(:last-child) {
				border-bottom: 1px solid ${token.colorBorder};
			}
		`,
		title: css`
			color: ${isDarkMode ? token.magicColorScales.grey[8] : token.magicColorUsages.text[1]};
			font-size: 16px;
			font-weight: 400;
			line-height: 22px;
		`,
		description: css`
			color: ${isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text[3]};
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
			text-align: left;
		`,
		extra: css`
			min-width: 270px;
			flex-shrink: 0;
		`,
	}
})
interface SettingItemProps {
	icon?: ReactNode
	title: ReactNode
	description?: ReactNode
	extra?: ReactNode
	/**
	 * 是否自适应移动端
	 * 如果为 true，则会在移动端显示为垂直布局
	 * 如果为 false，则会在移动端显示为水平布局
	 */
	adaptMobile?: boolean
}

const SettingItem = memo(
	({ icon, title, description, extra, adaptMobile = false }: SettingItemProps) => {
		const { styles } = useSettingItemStyles()
		const isMobile = useIsMobile()

		const props = useMemo(() => {
			return adaptMobile && isMobile
				? { vertical: true, gap: 10 }
				: { align: "center", justify: "space-between", gap: 10 }
		}, [adaptMobile, isMobile])

		const titleProps = useMemo(() => {
			return adaptMobile && isMobile
				? { vertical: false, justify: "space-between", align: "center" }
				: { vertical: true, align: "flex-start" }
		}, [adaptMobile, isMobile])

		const extraProps = useMemo(() => {
			return adaptMobile && isMobile
				? { justify: "flex-start" }
				: { align: "center", justify: "flex-end" }
		}, [adaptMobile, isMobile])

		return (
			<Flex {...props} className={styles.container}>
				<Flex align="center" gap={10}>
					{icon}
					<Flex {...titleProps} gap={2} flex={1}>
						<div
							className={styles.title}
							style={{
								minWidth: isMobile ? "unset" : "200px",
							}}
						>
							{title}
						</div>
						{description ? (
							<div className={styles.description}>{description}</div>
						) : null}
					</Flex>
				</Flex>
				<Flex
					className={styles.extra}
					style={{
						minWidth: isMobile ? "unset" : "270px",
					}}
					{...extraProps}
				>
					{extra}
				</Flex>
			</Flex>
		)
	},
)

export default SettingItem
