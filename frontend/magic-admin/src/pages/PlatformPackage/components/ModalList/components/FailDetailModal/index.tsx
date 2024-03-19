import type { MagicModalProps } from "components"
import { MagicModal } from "components"
import { memo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Flex } from "antd"
import { IconCircleXFilled } from "@tabler/icons-react"
import { useStyles } from "../../styles"

interface FailDetailModalProps extends MagicModalProps {
	currentResult: { text: string; error?: string } | null
}

export const FailDetailModal = memo(({ currentResult, ...props }: FailDetailModalProps) => {
	const { t } = useTranslation("admin/ai/model")
	const { styles } = useStyles()
	const [open, setOpen] = useState(true)

	const formatError = (error: string) => {
		try {
			return JSON.stringify(JSON.parse(error), null, 2)
		} catch {
			return error
		}
	}
	return (
		<MagicModal
			title={t("checkDetail")}
			footer={null}
			open={open}
			onCancel={() => setOpen(false)}
			centered
			{...props}
		>
			<Flex gap={10} vertical>
				<Flex gap={4} align="center" className={styles.error}>
					<IconCircleXFilled color="currentColor" size={20} />
					<div>{t("testStatus", { status: currentResult?.text })}</div>
				</Flex>
				{currentResult?.error && (
					<pre className={styles.errorJson}>{formatError(currentResult.error)}</pre>
				)}
			</Flex>
		</MagicModal>
	)
})
