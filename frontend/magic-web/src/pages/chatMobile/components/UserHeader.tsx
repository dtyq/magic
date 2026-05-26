import { createStyles } from "antd-style"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { IconChevronLeft } from "@tabler/icons-react"
import MagicIcon, { MagicIconProps } from "@/components/base/MagicIcon"
import { ButtonProps } from "antd"
import FlexBox from "@/components/base/FlexBox"
import { cn } from "@/lib/utils"

const useStyles = createStyles(({ token, css }) => ({
	userHeader: css`
		background-color: ${token.magicColorUsages?.bg?.[0]};
		padding: 10px 0;
		height: fit-content;
		border-bottom: 1px solid ${token.colorBorder};
	`,
	userInfo: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 10px;
		gap: 10px;
	`,
	userDetails: css`
		display: flex;
		flex-direction: column;
		justify-content: center;
		flex: 1;
	`,
	userName: css`
		color: ${token.magicColorUsages?.text?.[0]};
		font-size: 14px;
		font-style: normal;
		font-weight: 600;
		line-height: 20px;
	`,
	userCompany: css`
		color: ${token.magicColorUsages?.text?.[1]};
		font-size: 12px;
		font-style: normal;
		font-weight: 400;
		line-height: 16px;
	`,
	userActions: css`
		display: flex;
		gap: 4px;
	`,
	actionButton: css`
		width: 32px;
		height: 32px;
		border-radius: 4px;
		border: none;
		background-color: transparent;
		display: flex;
		justify-content: center;
		align-items: center;
		color: ${token.magicColorUsages?.text?.[1]};
		cursor: pointer;
		transition: background-color 0.2s ease;
		&:active {
			background-color: ${token.magicColorUsages?.bg?.[1]};
		}
	`,
	backArrow: css`
		color: ${token.magicColorUsages.text[1]};
	`,
	// 中间区域绝对居中，避免左侧返回或右侧按钮挂载时 tab/标题横向跳动
	centerOverlay: css`
		position: absolute;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		align-items: center;
		pointer-events: none;

		& > * {
			pointer-events: auto;
		}
	`,
	userInfoWithBack: css`
		position: relative;
	`,
	sideControl: css`
		position: relative;
		z-index: 1;
		flex-shrink: 0;
	`,
	userAvatar: css`
		margin-top: -1px;
	`,
}))

interface UserHeaderProps {
	center?: React.ReactNode
	buttons?: (Omit<ButtonProps, "icon"> & { icon: MagicIconProps["component"] })[]
	className?: string
	wrapperClassName?: string
	onBack?: () => void
	/** Reserve left back slot (e.g. skeleton) so center content does not shift when onBack mounts. */
	reserveBackSlot?: boolean
}

const UserHeader = observer(function UserHeader({
	buttons,
	center,
	className,
	wrapperClassName,
	onBack,
	reserveBackSlot = false,
}: UserHeaderProps) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("interface")
	const hasBackButton = onBack != null
	const hasBackLayout = hasBackButton || reserveBackSlot

	return (
		<div
			className={cn(
				wrapperClassName,
				styles.userHeader,
				"userHeader",
				"!pt-[max(10px,var(--safe-area-inset-top))]",
			)}
		>
			<div
				className={cx(styles.userInfo, hasBackLayout && styles.userInfoWithBack, className)}
			>
				{hasBackButton ? (
					<button
						type="button"
						className={cx(styles.actionButton, styles.sideControl)}
						onClick={onBack}
						aria-label={t("button.back")}
						data-testid="user-header-back-button"
					>
						<IconChevronLeft size={24} className={styles.backArrow} />
					</button>
				) : reserveBackSlot ? (
					<span
						className={cx(styles.actionButton, styles.sideControl)}
						aria-hidden
						data-testid="user-header-back-slot"
					/>
				) : null}
				{hasBackLayout ? (
					<div className={styles.centerOverlay}>{center}</div>
				) : (
					<FlexBox justify="flex-left" align="center" flex={1}>
						{center}
					</FlexBox>
				)}
				<div className={cx(styles.userActions, hasBackLayout && styles.sideControl)}>
					{buttons?.map((button, index) => (
						<button
							key={index}
							type="button"
							className={styles.actionButton}
							onClick={button.onClick}
						>
							<MagicIcon
								component={button.icon}
								size={24}
								color="currentColor"
								stroke={2}
							/>
						</button>
					))}
				</div>
			</div>
		</div>
	)
})

export default UserHeader
