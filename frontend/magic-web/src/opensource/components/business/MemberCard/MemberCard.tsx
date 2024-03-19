import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { getUserName } from "@/opensource/utils/modules/chat"
import { IconBuildingSkyscraper } from "@tabler/icons-react"
import { Descriptions, Flex } from "antd"
import { useRef } from "react"
import MagicSegmented from "@/opensource/components/base/MagicSegmented"
import { useMemoizedFn } from "ahooks"
import { useChatWithMember } from "@/opensource/hooks/chat/useChatWithMember"
import { observer } from "mobx-react-lite"
import { useMemberCardData } from "./hooks"
import useStyles from "./styles"
import MemberCardButtons from "./MemberCardButtons"
import OrganizationRender from "../OrganizationRender"
import userAvatarIcon from "@/opensource/assets/logos/user-avatar.svg"

interface MemberCardProps {
	classNames?: {
		container?: string
		header?: string
		headerTop?: string
		avatar?: string
		username?: string
		organization?: string
		descriptions?: string
		button?: string
		segmented?: string
	}
	style?: React.CSSProperties
	showButtons?: boolean
}

const MemberCard = observer(({ classNames, style, showButtons = true }: MemberCardProps) => {
	const {
		container,
		header,
		headerTop,
		avatar,
		username,
		organization: organizationClassName,
		descriptions,
		segmented,
	} = classNames ?? {}

	const containerRef = useRef<HTMLDivElement>(null)

	// Use custom hook for data logic
	const {
		userInfo,
		organization,
		isNormalPerson,
		items,
		tabOptions,
		storeState,
		setIsHover,
		closeCard,
	} = useMemberCardData()

	const { styles, cx } = useStyles({
		open: storeState.open,
		animationDuration: storeState.animationDuration,
		hidden: !userInfo,
	})

	const chatWith = useChatWithMember()

	const handleChatWith = useMemoizedFn(() => {
		if (!userInfo) return
		chatWith(userInfo.user_id)
		closeCard(true)
	})

	return (
		<Flex
			className={cx(styles.container, styles.animation, container)}
			vertical
			gap={14}
			ref={containerRef}
			style={{
				top: storeState.position.y,
				left: storeState.position.x,
				...style,
			}}
			onMouseEnter={() => setIsHover(true)}
			onMouseLeave={() => setIsHover(false)}
		>
			{/* 头部卡片 */}
			<Flex vertical className={cx(styles.header, header)} gap={10}>
				<Flex className={cx(styles.headerTop, headerTop)} gap={14} align="center">
					<MagicAvatar
						className={cx(styles.avatar, avatar)}
						src={userInfo?.avatar_url || userAvatarIcon}
						size={80}
					>
						{getUserName(userInfo)}
					</MagicAvatar>
					<span className={cx(styles.username, username)}>{getUserName(userInfo)}</span>
				</Flex>
				<Flex gap={2} align="center">
					<MagicIcon component={IconBuildingSkyscraper} />
					<span className={cx(styles.organization, organizationClassName)}>
						<OrganizationRender
							organizationCode={organization?.magic_organization_code}
						/>
					</span>
				</Flex>
				{/* {isNormalPerson && (
					<Flex gap={10}>
						<MagicButton
							block
							className={styles.scheduleButton}
							icon={
								<MagicIcon
									color="currentColor"
									component={IconCalendarTime}
									size={18}
								/>
							}
						>
							{t("memberCard.viewSchedule")}
						</MagicButton>
						<MagicButton
							block
							className={styles.tasksAssociatedWithMeButton}
							icon={
								<MagicIcon color="currentColor" component={IconSubtask} size={18} />
							}
						>
							{t("memberCard.tasksAssociatedWithMe")}
						</MagicButton>
					</Flex>
				)} */}
			</Flex>
			{isNormalPerson && (
				<MagicSegmented
					block
					className={cx(styles.segmented, segmented)}
					options={tabOptions}
				/>
			)}
			{/* 详情信息 */}
			<Descriptions
				colon={false}
				column={1}
				items={items}
				className={cx(styles.descriptions, descriptions)}
			/>
			{/* 底部按钮 */}
			<MemberCardButtons showButtons={showButtons} onChatWith={handleChatWith} />
		</Flex>
	)
})

export default MemberCard
