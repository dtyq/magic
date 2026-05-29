import { memo } from "react"
import { createStyles } from "antd-style"
import { Empty, Flex } from "antd"
import { MagicButton, MagicSpin } from "@admin-components"
import { useTranslation } from "react-i18next"
import type { ImportSourceModel } from "../utils"
import ImportSourceCard from "./ImportSourceCard"

interface ImportSourcePopoverProps {
	loading: boolean
	sources: ImportSourceModel[]
	selectedSourceId?: string
	onSelect: (id: string) => void
	onConfirm: () => void
	onClose: () => void
	className?: string
	style?: React.CSSProperties
}

const useStyles = createStyles(({ css, token }) => {
	return {
		panel: css`
			width: 420px;
			max-width: min(420px, calc(100vw - 48px));
		`,
		header: css`
			padding-bottom: 12px;
			border-bottom: 1px solid ${token.magicColorUsages.border};
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
		list: css`
			max-height: 360px;
			overflow-y: auto;
			scrollbar-width: none;
			padding: 12px 0;
		`,
		footer: css`
			padding-top: 12px;
			border-top: 1px solid ${token.magicColorUsages.border};
		`,
	}
})

const ImportSourcePopover = ({
	loading,
	sources,
	selectedSourceId,
	onSelect,
	onConfirm,
	onClose,
	className,
	style,
}: ImportSourcePopoverProps) => {
	const { t } = useTranslation("admin/ai/model")
	const { styles, cx } = useStyles()

	const selectedSource = sources.find((item) => item.id === selectedSourceId)

	return (
		<div className={cx(styles.panel, className)} style={style}>
			<Flex vertical gap={12}>
				<Flex vertical gap={4} className={styles.header}>
					<div className={styles.title}>{t("form.importSourceTitle")}</div>
					<div className={styles.desc}>
						{t("form.importSourceDesc", { count: sources.length })}
					</div>
				</Flex>

				<Flex vertical gap={8} className={styles.list}>
					{loading && (
						<Flex justify="center" align="center" style={{ minHeight: 120 }}>
							<MagicSpin />
						</Flex>
					)}
					{!loading && sources.length === 0 && (
						<Empty
							description={t("form.noImportSource")}
							image={Empty.PRESENTED_IMAGE_SIMPLE}
						/>
					)}
					{!loading &&
						sources.map((source) => (
							<ImportSourceCard
								key={source.id}
								source={source}
								isSelected={source.id === selectedSourceId}
								onSelect={() => onSelect(source.id)}
							/>
						))}
				</Flex>

				<Flex justify="end" gap={8} className={styles.footer}>
					<MagicButton type="default" onClick={onClose}>
						{t("form.cancelImport")}
					</MagicButton>
					<MagicButton
						type="primary"
						disabled={!selectedSource || loading}
						onClick={onConfirm}
					>
						{t("form.confirmImport")}
					</MagicButton>
				</Flex>
			</Flex>
		</div>
	)
}

export default memo(ImportSourcePopover)
