import { memo } from "react"
import { Flex } from "antd"
import { useTranslation } from "react-i18next"
import {
	IconX,
	IconThumbUp,
	IconUserHeart,
	IconUserPlus,
	IconMessagePlus,
	IconMessage,
} from "@tabler/icons-react"
import MagicPopup from "@/opensource/components/base-mobile/MagicPopup"
import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { useStyles } from "./styles"
import { AssistantPopupProps } from "./types"
import { DefaultAvatar } from "@/opensource/pages/explore/components"
import { FlowRouteType } from "@/opensource/types/flow"

const AssistantPopup = memo(
	({ visible, onClose, assistant, onAddAssistant }: AssistantPopupProps) => {
		const { t } = useTranslation("interface")
		const { styles } = useStyles()

		const handleAddAssistant = (addAgent: boolean, isNavigate: boolean) => {
			if (!assistant) return
			onAddAssistant?.(assistant, addAgent, isNavigate)
		}

		const isAdded = assistant?.is_add ?? false

		return (
			<MagicPopup
				visible={visible}
				onClose={onClose}
				onMaskClick={onClose}
				maskClassName={styles.mask}
			>
				<div className={styles.container}>
					{/* Close Button */}
					<div className={styles.closeButton}>
						<MagicButton
							type="text"
							shape="circle"
							size="small"
							icon={<MagicIcon component={IconX} size={20} />}
							onClick={onClose}
						/>
					</div>

					{/* Content */}
					<Flex vertical gap={12} className={styles.content}>
						{/* Avatar and Title */}
						<Flex vertical align="center" gap={12}>
							<div className={styles.avatarContainer}>
								{assistant?.robot_avatar ? (
									<img
										src={assistant?.robot_avatar}
										alt={assistant?.robot_name}
										className={styles.avatar}
									/>
								) : (
									<DefaultAvatar type={FlowRouteType.Agent} size={70} />
								)}
							</div>

							<div className={styles.title}>{assistant?.robot_name}</div>

							{/* Tags */}
							{/* <Flex wrap gap={4} justify="center" className={styles.tagsContainer}>
								{assistant?.tags?.map((tag, index) => (
									<MagicTag key={index} color="orange" className={styles.tag}>
										{tag}
									</MagicTag>
								))}
							</Flex> */}
						</Flex>

						{/* Description */}
						<div className={styles.description}>{assistant?.robot_description}</div>

						{/* Stats */}
						<div className={styles.statsContainer}>
							<Flex gap={20} justify="center">
								<Flex align="center" gap={4}>
									<Flex align="center" gap={2}>
										<MagicIcon component={IconThumbUp} size={14} />
										<span className={styles.statsLabel}>
											{t("explore.descriptionPanel.good")}
										</span>
									</Flex>
									<span className={styles.statsValue}>0</span>
								</Flex>

								<Flex align="center" gap={4}>
									<Flex align="center" gap={2}>
										<MagicIcon component={IconUserHeart} size={14} />
										<span className={styles.statsLabel}>
											{t("explore.descriptionPanel.usageCount")}
										</span>
									</Flex>
									<span className={styles.statsValue}>0</span>
								</Flex>
							</Flex>
						</div>
					</Flex>

					{/* Action Buttons */}
					<Flex vertical gap={8} className={styles.actionButtons}>
						<MagicButton
							block
							disabled={isAdded}
							icon={
								<MagicIcon
									component={IconUserPlus}
									size={18}
									color="currentColor"
								/>
							}
							onClick={() => handleAddAssistant(true, false)}
							className={isAdded ? styles.addedButton : styles.addButton}
						>
							{isAdded
								? t("explore.descriptionPanel.alreadyAddAgent")
								: t("explore.descriptionPanel.onlyAddAgent")}
						</MagicButton>

						<MagicButton
							block
							icon={
								<MagicIcon
									component={isAdded ? IconMessage : IconMessagePlus}
									size={18}
									color="currentColor"
								/>
							}
							onClick={() => handleAddAssistant(!isAdded, true)}
							className={isAdded ? styles.chatButton : styles.conversationButton}
						>
							{isAdded
								? t("explore.descriptionPanel.initiateAsession")
								: t("explore.descriptionPanel.addFriendAndChat")}
						</MagicButton>
					</Flex>
				</div>
			</MagicPopup>
		)
	},
)

AssistantPopup.displayName = "AssistantPopup"

export default AssistantPopup
