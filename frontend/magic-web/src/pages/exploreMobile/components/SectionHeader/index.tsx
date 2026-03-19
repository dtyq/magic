import { memo } from "react"
import { createStyles } from "antd-style"
import { CSS_VARIABLES } from "../../constants"

const useStyles = createStyles(({ token, css }) => ({
	container: css`
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		padding-inline: var(${CSS_VARIABLES.explorePagePaddingInline});
		margin-top: 12px;
	`,
	content: css`
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
	`,
	title: css`
		color: ${token.magicColorUsages?.text?.[0]};
		font-family: "PingFang SC", sans-serif;
		font-size: 14px;
		font-weight: 600;
		line-height: 1.43;
		margin: 0;
	`,
	subtitle: css`
		color: ${token.magicColorUsages?.text?.[3]};
		font-family: "PingFang SC", sans-serif;
		font-size: 12px;
		font-weight: 400;
		line-height: 1.33;
		margin: 0;
	`,
	viewAllButton: css`
		color: #315cec;
		font-family: "PingFang SC", sans-serif;
		font-size: 12px;
		font-weight: 400;
		line-height: 1.33;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		white-space: nowrap;

		&:hover {
			opacity: 0.8;
		}

		&:active {
			opacity: 0.6;
		}
	`,
}))

export interface SectionHeaderProps {
	title: string
	subtitle: string
	viewAllText?: string
	onViewAll?: () => void
}

// PropTypes validation would be here if needed, but TypeScript provides compile-time checking

const SectionHeader = memo(({ title, subtitle, viewAllText, onViewAll }: SectionHeaderProps) => {
	const { styles } = useStyles()

	return (
		<div className={styles.container}>
			<div className={styles.content}>
				<h2 className={styles.title}>{title}</h2>
				<p className={styles.subtitle}>{subtitle}</p>
			</div>
			{onViewAll && viewAllText && (
				<button className={styles.viewAllButton} onClick={onViewAll}>
					{viewAllText}
				</button>
			)}
		</div>
	)
})

SectionHeader.displayName = "SectionHeader"

export default SectionHeader
