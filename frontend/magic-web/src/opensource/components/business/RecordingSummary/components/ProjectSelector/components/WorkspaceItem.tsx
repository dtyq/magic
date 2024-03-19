import { createStyles } from "antd-style"
import { WorkspaceItemProps } from "../types"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { IconCheck, IconChevronRight } from "@tabler/icons-react"
import IconWorkspace from "@/opensource/pages/superMagic/components/icons/IconWorkspace"
import FlexBox from "@/opensource/components/base/FlexBox"
import MagicIcon from "@/opensource/components/base/MagicIcon"

const useStyles = createStyles(({ css, token }) => ({
	projectItem: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 10px;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		border: 1px solid transparent;

		&:hover {
			background-color: ${token.colorFillTertiary};
		}

		&.selected {
			background-color: #eef3fd;
			border-color: ${token.magicColorUsages.primary.default};
		}
	`,

	projectInfo: css`
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1;
		min-width: 0;
	`,

	projectDetails: css`
		display: flex;
		align-items: center;
		gap: 4px;
		flex: 1;
		min-width: 0;
	`,

	projectIcon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background-color: ${token.colorFillQuaternary};
		border-radius: 4px;
		flex-shrink: 0;

		.anticon {
			color: ${token.colorTextSecondary};
			font-size: 14px;
		}
	`,

	projectName: css`
		font-size: 14px;
		line-height: 20px;
		color: ${token.colorText};
		font-weight: 400;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-right: 4px;
	`,

	checkIcon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		color: ${token.magicColorUsages.primary.default};

		&.hidden {
			opacity: 0;
			visibility: hidden;
		}
	`,

	arrowIcon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		border-radius: 4px;

		&:hover {
			background-color: ${token.magicColorUsages.fill[0]};
		}
	`,
}))

function WorkspaceItem({ workspace, selected = false, onClick, onArrowClick }: WorkspaceItemProps) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	const handleClick = useMemoizedFn(() => {
		onClick?.(workspace)
	})

	const handleArrowClick = useMemoizedFn((e: React.MouseEvent<HTMLDivElement>) => {
		e.stopPropagation()
		onArrowClick?.(workspace)
	})

	return (
		<div className={cx(styles.projectItem, selected && "selected")} onClick={handleClick}>
			<div className={styles.projectInfo}>
				<div className={styles.projectDetails}>
					<div className={styles.projectIcon}>
						<IconWorkspace />
					</div>
					<div
						className={styles.projectName}
						title={workspace.name || t("workspace.unnamedWorkspace")}
					>
						{workspace.name || t("workspace.unnamedWorkspace")}
					</div>
				</div>
			</div>
			<FlexBox gap={4} align="center" justify="center">
				{selected && (
					<div className={cx(styles.checkIcon)}>
						<MagicIcon component={IconCheck} size={20} color="currentColor" />
					</div>
				)}
				<div className={styles.arrowIcon} onClick={handleArrowClick}>
					<IconChevronRight />
				</div>
			</FlexBox>
		</div>
	)
}

export default WorkspaceItem
