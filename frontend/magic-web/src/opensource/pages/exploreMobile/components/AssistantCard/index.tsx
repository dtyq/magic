import { memo } from "react"
import { createStyles } from "antd-style"
import { AssistantData } from "../../types"
import { DefaultAvatar } from "@/opensource/pages/explore/components"
import { FlowRouteType } from "@/opensource/types/flow"

const useStyles = createStyles(({ token, css }) => ({
	card: css`
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0;
		background: transparent;
		border: none;
		cursor: pointer;
		width: 100%;
		text-align: left;

		&:active {
			opacity: 0.8;
		}
	`,
	iconContainer: css`
		width: 44px;
		height: 44px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		overflow: hidden;
	`,
	icon: css`
		width: 100%;
		height: 100%;
		object-fit: cover;
	`,
	content: css`
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
		min-width: 0;
	`,
	name: css`
		color: ${token.magicColorUsages?.text?.[0]};
		font-family: "PingFang SC", sans-serif;
		font-size: 12px;
		font-weight: 600;
		line-height: 1.33;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
	description: css`
		color: ${token.magicColorUsages?.text?.[3]};
		font-family: "PingFang SC", sans-serif;
		font-size: 10px;
		font-weight: 400;
		line-height: 1.1;
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		word-break: break-word;
		min-height: 22px;
		overflow: hidden;
	`,
}))

export interface AssistantCardProps {
	assistant: AssistantData
	onClick?: () => void
}

const AssistantCard = memo(({ assistant, onClick }: AssistantCardProps) => {
	const { styles } = useStyles()

	return (
		<button className={styles.card} onClick={onClick}>
			<div className={styles.iconContainer}>
				{assistant.robot_avatar ? (
					<img
						src={assistant.robot_avatar}
						alt={assistant.robot_name}
						className={styles.icon}
					/>
				) : (
					<DefaultAvatar type={FlowRouteType.Agent} size={44} />
				)}
			</div>
			<div className={styles.content}>
				<h3 className={styles.name}>{assistant.robot_name}</h3>
				<p className={styles.description}>{assistant.robot_description}</p>
			</div>
		</button>
	)
})

AssistantCard.displayName = "AssistantCard"

export default AssistantCard
