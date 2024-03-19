import { memo, useState } from "react"
import { clipboard } from "@/opensource/utils/clipboard-helpers"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { IconCopy, IconCheck } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { FlexBox } from "@/opensource/components/base"
import { useStyles } from "./styles"

interface MagicIdDisplayProps {
	magicId?: string
}

function MagicIdDisplay({ magicId }: MagicIdDisplayProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("accountSetting")
	const [isCopied, setIsCopied] = useState(false)

	if (!magicId) return null

	async function handleCopy() {
		try {
			await clipboard.writeText(magicId)
			setIsCopied(true)
			magicToast.success(t("copySuccess"))
			setTimeout(() => setIsCopied(false), 2000)
		} catch (error) {
			console.error("Failed to copy Magic ID:", error)
			magicToast.error(t("copyFailed"))
		}
	}

	return (
		<FlexBox
			align="center"
			gap={4}
			className={styles.magicIdDetail}
			data-testid="account-setting-magic-id-display"
		>
			<span className={styles.magicIdLabel}>Magic ID</span>
			<div className={styles.magicIdText}>{magicId}</div>
			<div
				className={styles.copyButton}
				onClick={handleCopy}
				data-testid="account-setting-magic-id-copy-button"
			>
				{isCopied ? (
					<IconCheck size={16} className={styles.copyIcon} />
				) : (
					<IconCopy size={16} className={styles.copyIcon} />
				)}
			</div>
		</FlexBox>
	)
}

export default memo(MagicIdDisplay)
