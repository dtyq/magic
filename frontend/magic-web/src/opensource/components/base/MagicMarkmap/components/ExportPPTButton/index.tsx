import type { MagicButtonProps } from "@/opensource/components/base/MagicButton"
import MagicButton from "@/opensource/components/base/MagicButton"
import MagicMarpit from "@/opensource/components/base/MagicMarpit"
import MagicModal from "@/opensource/components/base/MagicModal"
import IconWandColorful from "@/opensource/enhance/tabler/icons-react/icons/IconWandColorful"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { useBoolean } from "ahooks"
import { useStyles } from "./styles"

const ExportPPTButton = memo(({ content, className, ...rest }: MagicButtonProps) => {
	const { t } = useTranslation("interface")
	const { styles, cx } = useStyles()

	const [open, { setTrue, setFalse }] = useBoolean(false)

	if (!content) return null

	return (
		<>
			<MagicButton
				type="text"
				className={cx(styles.button, className)}
				icon={<IconWandColorful />}
				onClick={setTrue}
				{...rest}
			>
				<span className={styles.text}>{t("chat.markmap.generatePPT")}</span>
			</MagicButton>
			<MagicModal
				open={open}
				width="fit-content"
				destroyOnClose
				classNames={{
					body: styles.modalBody,
				}}
				title={t("chat.markmap.generatePPT")}
				onCancel={setFalse}
				closable
				footer={null}
			>
				<MagicMarpit content={content} />
			</MagicModal>
		</>
	)
})

export default ExportPPTButton
