import { Card, Flex, type CardProps } from "antd"
import { createStyles, cx } from "antd-style"
import type { ReactNode } from "react"
import { forwardRef, memo, useMemo } from "react"
import { IconX } from "@tabler/icons-react"
import MagicButton from "../MagicButton"
import MagicIcon from "../MagicIcon"

const useStyles = createStyles(({ css, isDarkMode, prefixCls, token }) => {
	return {
		card: {
			height: "100%",
			overflow: "hidden",
			borderRadius: 0,
			display: "flex",
			flexDirection: "column",
			backgroundColor: `${isDarkMode ? "#141414" : token.magicColorUsages.white}`,
			[`.${prefixCls}-card-body`]: {
				flex: 1,
				display: "flex",
			},
		},
		cardHeader: {
			borderRadius: "0 !important",
			position: "sticky",
			top: 0,
			color: `${
				isDarkMode ? token.magicColorScales.grey[8] : token.magicColorUsages.text[1]
			} !important`,
			zIndex: 10,
			backdropFilter: "blur(12px)",
			background: isDarkMode
				? `${token.magicColorScales.grey[0]} !important`
				: token.magicColorUsages.white,
			[`--${prefixCls}-padding-lg`]: "20px",
		},
		cardBody: css`
			height: calc(100vh - 55px);
			--${prefixCls}-padding-lg: 0;
			--${prefixCls}-card-body-padding: 0;
		`,

		closeButton: css`
			.${prefixCls}-btn-icon {
				height: 24px;
			}
		`,
	}
})

const usePageContainerStyles = () => {
	const { styles } = useStyles()
	return {
		styles,
		classNames: { header: styles.cardHeader, body: styles.cardBody },
	}
}

interface PageContainerProps extends CardProps {
	className?: string
	icon?: ReactNode
	closeable?: boolean
	onClose?: () => void
}

const PageContainer = memo(
	forwardRef<HTMLDivElement, PageContainerProps>(
		(
			{
				children,
				className,
				classNames,
				icon,
				title: _title,
				closeable = false,
				onClose,
				...props
			},
			ref,
		) => {
			const { styles, classNames: pageContainerClassNames } = usePageContainerStyles()

			const title = useMemo(() => {
				return (
					<Flex align="center" justify="space-between">
						<Flex align="center" gap={8}>
							{icon}
							{_title}
						</Flex>
						<MagicButton
							type="text"
							hidden={!closeable}
							className={styles.closeButton}
							icon={<MagicIcon component={IconX} />}
							onClick={onClose}
						/>
					</Flex>
				)
			}, [_title, closeable, icon, onClose, styles.closeButton])

			return (
				<Card
					ref={ref}
					className={cx(styles.card, className)}
					variant="borderless"
					classNames={{
						...pageContainerClassNames,
						header: cx(pageContainerClassNames?.header, classNames?.header),
						body: cx(pageContainerClassNames?.body, classNames?.body),
					}}
					title={title}
					{...props}
				>
					{children}
				</Card>
			)
		},
	),
)

export default PageContainer
