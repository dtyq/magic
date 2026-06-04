import { memo } from "react"
import type { FormInstance } from "antd"
import { Flex } from "antd"
import { createStyles } from "antd-style"
import { useTranslation } from "react-i18next"
import { MagicButton } from "@admin-components"
import { ModelSelect } from "../../ModelSelect"

export type ImportStatus = {
	type: "empty" | "success"
	text: string
} | null

interface ImportModelCardProps {
	form: FormInstance
	selectedModelId?: string
	importSourceLoading: boolean
	importStatus: ImportStatus
	actionType?: "edit" | "copy" | "create"
	onQueryImportSources: () => void
	onResetToBlank: () => void
}

const useStyles = createStyles(({ css, token }) => {
	return {
		card: css`
			padding: 16px;
			border-radius: 12px;
			border: 1px solid ${token.magicColorUsages.border};
			background: ${token.magicColorScales.grey[0]};
		`,
		title: css`
			font-size: 14px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[1]};
		`,
		desc: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[3]};
		`,
		actions: css`
			display: flex;
			align-items: flex-start;
			gap: 8px;
			flex-wrap: wrap;
		`,
		status: css`
			font-size: 12px;
			padding: 8px 12px;
			border-radius: 10px;
			background: ${token.magicColorUsages.bg[0]};
			border: 1px solid ${token.magicColorUsages.border};
			color: ${token.magicColorUsages.text[2]};
		`,
		statusSuccess: css`
			color: ${token.magicColorUsages.primary.default};
			border-color: ${token.magicColorUsages.primary.default};
		`,
	}
})

const ImportModelCard = ({
	form,
	selectedModelId,
	importSourceLoading,
	importStatus,
	actionType,
	onQueryImportSources,
	onResetToBlank,
}: ImportModelCardProps) => {
	const { t } = useTranslation("admin/ai/model")
	const { styles, cx } = useStyles()

	return (
		<div className={styles.card}>
			<Flex vertical gap={12}>
				<Flex vertical gap={4}>
					<div className={styles.title}>{t("form.importModelConfig")}</div>
					<div className={styles.desc}>{t("form.importModelConfigDesc")}</div>
				</Flex>

				<Flex gap={12} align="flex-start" wrap>
					<Flex flex={1} style={{ minWidth: 320 }}>
						<ModelSelect
							form={form}
							showCopyButton={false}
							showDescription={false}
							standalone
						/>
					</Flex>

					<Flex className={styles.actions}>
						<MagicButton
							type="primary"
							loading={importSourceLoading}
							disabled={!selectedModelId}
							onClick={onQueryImportSources}
						>
							{t("form.searchAndImport")}
						</MagicButton>
						{actionType === "create" && (
							<MagicButton type="default" onClick={onResetToBlank}>
								{t("form.createBlankConfig")}
							</MagicButton>
						)}
					</Flex>
				</Flex>

				{importStatus && (
					<div
						className={cx(
							styles.status,
							importStatus.type === "success" && styles.statusSuccess,
						)}
					>
						{importStatus.text}
					</div>
				)}
			</Flex>
		</div>
	)
}

export default memo(ImportModelCard)
