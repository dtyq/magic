import React, { useMemo, useState } from "react"
import { Input, Button } from "antd"
import { IconLink } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import type { Editor } from "@tiptap/react"
import { isValidImageUrl } from "../utils/url-validator"
import { useStyles } from "../styles"
import FlexBox from "@/components/base/FlexBox"

interface LinkTabProps {
	editor: Editor | null
	onSuccess?: () => void
}

export function LinkTab({ editor, onSuccess }: LinkTabProps) {
	const { t } = useTranslation("tiptap")
	const { styles } = useStyles()
	const [url, setUrl] = useState("")

	// Validate URL in real-time
	const isValid = useMemo(() => isValidImageUrl(url), [url])

	const handleInsert = () => {
		if (!editor || !isValid) return

		// Insert image using the editor command
		editor.commands.setImage({ src: url.trim() })

		// Clear input
		setUrl("")

		// Close the dropdown
		onSuccess?.()
	}

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && isValid) {
			handleInsert()
		}
	}

	return (
		<FlexBox vertical gap={10} justify="center" align="center" className={styles.tabContent}>
			<div className={styles.linkInputWrapper}>
				<Input
					prefix={<IconLink size={16} />}
					placeholder={t("projectImage.dropdown.link.placeholder")}
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					onKeyDown={handleKeyPress}
					className={styles.linkInput}
					size="large"
					status={url && !isValid ? "error" : undefined}
				/>
				{url && !isValid && (
					<div style={{ color: "#ff4d4f", fontSize: "12px", marginTop: "8px" }}>
						{t("projectImage.dropdown.link.error.invalidUrl")}
					</div>
				)}
			</div>

			<Button
				type="primary"
				block
				disabled={!isValid}
				onClick={handleInsert}
				className={styles.linkButton}
			>
				{t("projectImage.dropdown.link.button")}
			</Button>

			<div className={styles.hint}>{t("projectImage.dropdown.link.hint")}</div>
		</FlexBox>
	)
}
