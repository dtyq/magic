// React 相关
import { useState } from "react"
import { observer } from "mobx-react-lite"

// 类型导入
import type { DrawerProps } from "antd"

// UI 组件库
import { Checkbox, Drawer } from "antd"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import MagicButton from "@/opensource/components/base/MagicButton"
import AutoTooltipText from "@/opensource/components/other/AutoTooltipText"

// 图标
import { IconChevronLeft } from "@tabler/icons-react"

// 工具函数/Hooks
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import useGroupInfo from "@/opensource/hooks/chat/useGroupInfo"
import { getUserJobTitle, getUserName } from "@/opensource/utils/modules/chat"

// 样式
import { useStyles } from "./style"

// 服务与存储
import groupInfoStore from "@/opensource/stores/groupInfo"
import userInfoStore from "@/opensource/stores/userInfo"
import { ChatApi } from "@/opensource/apis"
import groupInfoService from "@/opensource/services/groupInfo"
import MagicSafeArea from "@/opensource/components/base/MagicSafeArea"
import FlexBox from "@/opensource/components/base/FlexBox"

interface ChatSettingProps extends DrawerProps {
	onClose?: () => void
	groupId: string
}

const RemoveGroupMember = observer(
	({ open, groupId, onClose: onCloseInProps }: ChatSettingProps) => {
		const { styles } = useStyles()
		const { t } = useTranslation("interface")

		const onClose = useMemoizedFn(() => {
			onCloseInProps?.()
		})

		const { groupInfo } = useGroupInfo(groupId)

		const members = groupInfoStore.currentGroupMembers

		const [selectedMembers, setSelectedMembers] = useState<string[]>([])

		const onSelectMember = useMemoizedFn((userId: string) => {
			setSelectedMembers((prev) => {
				if (prev.includes(userId)) {
					return prev.filter((id) => id !== userId)
				}
				return [...prev, userId]
			})
		})

		const onRemoveMembers = useMemoizedFn((userIds: string[]) => {
			if (!userIds.length) return
			ChatApi.kickGroupUsers({
				group_id: groupId,
				user_ids: userIds,
			}).then(() => {
				setSelectedMembers([])
				groupInfoStore.removeGroupMembers(userIds)
				groupInfoService.fetchGroupMembers(groupId)
			})
		})

		if (!groupId) return null

		return (
			<Drawer
				open={open}
				closable
				onClose={onClose}
				title={
					<FlexBox align="center" gap={4}>
						<MagicIcon component={IconChevronLeft} size={24} onClick={onClose} />
						{t("chat.groupSetting.removeMember")}
					</FlexBox>
				}
				width={380}
				push={false}
				classNames={{
					header: styles.header,
					mask: styles.mask,
					body: styles.body,
				}}
			>
				<FlexBox vertical className={styles.memberList} flex={1}>
					{members.map((user) => {
						const userInfo = userInfoStore.get(user.user_id)

						return (
							<FlexBox
								key={user.user_id}
								align="center"
								justify="space-between"
								gap={8}
								className={styles.memberItem}
							>
								<Checkbox
									disabled={userInfo?.user_id === groupInfo?.group_owner}
									checked={selectedMembers.includes(user.user_id)}
									onChange={() => onSelectMember(user.user_id)}
								/>
								<MagicAvatar size={28} src={userInfo?.avatar_url}>
									{getUserName(userInfo)}
								</MagicAvatar>
								<FlexBox vertical flex={1} className={styles.memberInfo}>
									<AutoTooltipText>{getUserName(userInfo)}</AutoTooltipText>
									<AutoTooltipText className={styles.jobTitle}>
										{getUserJobTitle(userInfo)}
									</AutoTooltipText>
								</FlexBox>
								{userInfo?.user_id !== groupInfo?.group_owner && (
									<MagicButton
										type="default"
										danger
										className={styles.removeButton}
										onClick={() => onRemoveMembers([user.user_id])}
									>
										{t("chat.groupSetting.remove")}
									</MagicButton>
								)}
							</FlexBox>
						)
					})}
				</FlexBox>
				{selectedMembers.length > 0 && (
					<MagicButton
						className={styles.removeCheckedButton}
						size="large"
						block
						type="primary"
						onClick={() => onRemoveMembers(selectedMembers)}
					>
						{t("chat.groupSetting.remove")} ({selectedMembers.length})
					</MagicButton>
				)}
				<MagicSafeArea position="bottom" />
			</Drawer>
		)
	},
)

export default RemoveGroupMember
