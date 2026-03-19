import MagicAvatar from "@/components/base/MagicAvatar"
import { getUserName } from "@/utils/modules/chat"
import { Flex } from "antd"
import { cx } from "antd-style"
import AutoTooltipText from "@/components/other/AutoTooltipText"
import { memo } from "react"
import MemberCardStore from "@/stores/display/MemberCardStore"
import userInfoStore from "@/stores/userInfo"
import { observer } from "mobx-react-lite"
import { useStyles } from "./styles"
import type { MagicMemberAvatarProps } from "./types"

const MagicMemberAvatar = observer(
	({
		uid,
		showName = "none",
		showAvatar = true,
		classNames,
		className,
		showPopover = true,
		children,
		...rest
	}: MagicMemberAvatarProps) => {
		const userInfo = uid ? userInfoStore.get(uid) : undefined
		const { styles } = useStyles({ nameVisible: showName })

		const name = getUserName(userInfo) ?? ""

		const Children: React.ReactNode =
			typeof children === "function" ? children(userInfo) : children

		return (
			<div
				className={cx(showPopover && MemberCardStore.domClassName)}
				data-user-id={userInfo?.user_id}
			>
				{Children ?? (
					<Flex
						vertical={showName === "vertical"}
						align={showName !== "none" ? "center" : undefined}
						gap={4}
						className={className}
					>
						{showAvatar ? (
							<MagicAvatar
								shape="square"
								src={userInfo?.avatar_url}
								className={cx(styles.avatar, classNames?.avatar)}
								{...rest}
							>
								{name}
							</MagicAvatar>
						) : null}
						{showName !== "none" ? (
							<AutoTooltipText
								maxWidth={showName === "vertical" ? 40 : undefined}
								className={cx(styles.name, classNames?.name)}
							>
								{name}
							</AutoTooltipText>
						) : null}
					</Flex>
				)}
			</div>
		)
	},
)

const memoizedMagicMemberAvatar = memo(MagicMemberAvatar)

export default memoizedMagicMemberAvatar
