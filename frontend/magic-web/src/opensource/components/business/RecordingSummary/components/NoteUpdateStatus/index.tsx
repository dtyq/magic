import { Flex } from "antd"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { getServiceInstance } from "@/opensource/services/recordSummary/serviceInstance"
import recordSummaryStore from "@/opensource/stores/recordingSummary"
import LoadingIcon from "../LoadingIcon"
import { MagicIcon } from "@/opensource/components/base"
import { IconCircleCheck, IconCircleX } from "@tabler/icons-react"
import { createStyles, useTheme } from "antd-style"

const useStyles = createStyles(({ css, token }) => ({
	errorContainer: css`
		cursor: pointer;
	`,
	text: css`
		color: ${token.magicColorUsages.text[2]};
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
	`,
}))

function NoteUpdateStatus() {
	const { t } = useTranslation("super")
	const status = recordSummaryStore.updateNoteStatus
	const { magicColorUsages } = useTheme()
	const { styles } = useStyles()

	function handleRetry() {
		const recordSummaryService = getServiceInstance()
		if (!recordSummaryService) return
		recordSummaryService.flushNoteUpdate(recordSummaryStore.note.content)
	}

	if (status === "idle") return null

	if (status === "saving") {
		return (
			<Flex align="center" gap={4}>
				<LoadingIcon size={12} />
				<span className={styles.text} role="status">
					{t("recordingSummary.noteStatus.saving")}
				</span>
			</Flex>
		)
	}

	if (status === "success") {
		return (
			<Flex align="center" gap={4}>
				<MagicIcon
					component={IconCircleCheck}
					size={12}
					color={magicColorUsages.success.default}
				/>
				<span className={styles.text} role="status">
					{t("recordingSummary.noteStatus.success")}
				</span>
			</Flex>
		)
	}

	return (
		<Flex className={styles.errorContainer} align="center" gap={4} onClick={handleRetry}>
			<MagicIcon component={IconCircleX} size={12} color={magicColorUsages.danger.default} />
			<span className={styles.text} role="status">
				{t("recordingSummary.noteStatus.error")}
			</span>
		</Flex>
	)
}

export default observer(NoteUpdateStatus)
