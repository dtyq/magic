import { createStyles } from "antd-style"
import { observer } from "mobx-react-lite"
import MagicIcon, { MagicIconProps } from "@/opensource/components/base/MagicIcon"
import { ButtonProps } from "antd"
import FlexBox from "@/opensource/components/base/FlexBox"
import { cn } from "@/opensource/lib/utils"

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
	userAvatar: css`
		margin-top: -1px;
	`,
}))

// interface UserHeaderProps {
// 	userName?: string
// 	userCompany?: string
// 	userAvatar?: string
// 	onSearchClick?: () => void
// 	onAddClick?: () => void
// }

interface UserHeaderProps {
	center?: React.ReactNode
	buttons?: (Omit<ButtonProps, "icon"> & { icon: MagicIconProps["component"] })[]
	className?: string
	wrapperClassName?: string
}

const UserHeader = observer(function UserHeader({
	buttons,
	center,
	className,
	wrapperClassName,
}: UserHeaderProps) {
	// const { onSearchClick, onAddClick } = props
	const { styles, cx } = useStyles()
	return (
		<div
			className={cn(
				wrapperClassName,
				styles.userHeader,
				"userHeader",
				"!pt-[max(10px,var(--safe-area-inset-top))]",
			)}
		>
			<div className={cx(styles.userInfo, className)}>
				{/* <UserAvatarRender
					userInfo={userInfo}
					size={32}
					style={{ borderRadius: 4 }}
					onClick={() => mobileTabStore.openUserMyPopup()}
				/> */}
				<FlexBox justify="flex-left" align="center" flex={1}>
					{center}
				</FlexBox>
				<div className={styles.userActions}>
					{/* <button className={styles.actionButton} onClick={onSearchClick}>
						<MagicIcon
							component={IconSearch}
							size={24}
							color="currentColor"
							stroke={2}
						/>
					</button>
					<button className={styles.actionButton} >
						<MagicIcon
							component={IconCirclePlus}
							size={24}
							color="currentColor"
							stroke={2}
						/>
					</button> */}
					{buttons?.map((button, index) => (
						<button
							key={index}
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
