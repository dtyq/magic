import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"
import { IconArrowRight } from "@tabler/icons-react"
import { userStore } from "@/opensource/models/user"
import { useStyles } from "./styles"
import { cx } from "antd-style"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { useMemo } from "react"
import TypewriterText from "./TypewriterText"

function MessageListFallback() {
	const { styles } = useStyles()
	const { t } = useTranslation("super")
	const { userInfo } = userStore.user

	const userName = userInfo?.nickname || userInfo?.user_id || ""

	const handleCardClick = useMemoizedFn((content: string) => {
		pubsub.publish(PubSubEvents.Send_Message_by_Content, {
			jsonContent: {
				type: "paragraph",
				content: [
					{
						type: "text",
						text: content,
					},
				],
			},
		})
	})

	const GreetingIcon = useMemo(() => {
		return <span className={styles.greetingIcon}>👋</span>
	}, [styles.greetingIcon])

	const greetingText = useMemo(
		() => t("recordingSummary.messageListFallback.greeting", { userName }),
		[t, userName],
	)

	return (
		<div className={styles.container}>
			<div className={styles.greeting}>
				{GreetingIcon}
				<TypewriterText
					text={greetingText}
					className={styles.greetingText}
					speed={50}
					punctuationDelay={800}
				/>
			</div>
			<p className={styles.description}>
				{t("recordingSummary.messageListFallback.description")}
			</p>
			<div
				className={cx(styles.card, styles.cardBlue)}
				onClick={() =>
					handleCardClick(t("recordingSummary.messageListFallback.cardReviewContent"))
				}
			>
				<span className={styles.cardIcon}>🔍</span>
				<span className={styles.cardText}>
					{t("recordingSummary.messageListFallback.cardReviewContent")}
				</span>
				<div className={cx(styles.cardArrow, styles.arrowBlue)}>
					<IconArrowRight size={20} />
				</div>
			</div>
			<div
				className={cx(styles.card, styles.cardCyan)}
				onClick={() =>
					handleCardClick(t("recordingSummary.messageListFallback.cardQuestions"))
				}
			>
				<span className={styles.cardIcon}>💭</span>
				<span className={styles.cardText}>
					{t("recordingSummary.messageListFallback.cardQuestions")}
				</span>
				<div className={cx(styles.cardArrow, styles.arrowCyan)}>
					<IconArrowRight size={20} />
				</div>
			</div>
			<div
				className={cx(styles.card, styles.cardOrange)}
				onClick={() =>
					handleCardClick(t("recordingSummary.messageListFallback.cardOrganizeAboutMe"))
				}
			>
				<span className={styles.cardIcon}>💡</span>
				<span className={styles.cardText}>
					{t("recordingSummary.messageListFallback.cardOrganizeAboutMe")}
				</span>
				<div className={cx(styles.cardArrow, styles.arrowOrange)}>
					<IconArrowRight size={20} />
				</div>
			</div>
		</div>
	)
}

export default observer(MessageListFallback)
