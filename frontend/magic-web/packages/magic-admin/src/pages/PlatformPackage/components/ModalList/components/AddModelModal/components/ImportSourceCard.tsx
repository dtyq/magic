import { memo, useMemo, useState } from "react"
import { Flex, Tag } from "antd"
import dayjs from "dayjs"
import {
	IconChevronDown,
	IconChevronUp,
	IconClock,
	IconEyeSpark,
	IconTools,
	IconTopologyStarRing3,
} from "@tabler/icons-react"
import { createStyles } from "antd-style"
import { useTranslation } from "react-i18next"
import type { ImportSourceModel } from "../utils"
import { getImportSourceProviderName } from "../utils"
import {
	getImportSourceDetailSections,
	type ImportSourceDetailField,
} from "../utils/importSourceDetails"

interface ImportSourceCardProps {
	source: ImportSourceModel
	isSelected: boolean
	onSelect: () => void
}

const useStyles = createStyles(({ css, token }) => {
	return {
		card: css`
			padding: 12px;
			border-radius: 12px;
			border: 1px solid ${token.magicColorUsages.border};
			background: ${token.magicColorUsages.bg[0]};
			cursor: pointer;
			transition:
				border-color 0.2s ease,
				box-shadow 0.2s ease;

			&:hover {
				border-color: ${token.magicColorUsages.primary.default};
			}
		`,
		cardSelected: css`
			border-color: ${token.magicColorUsages.primary.default};
			border-width: 2px;
			box-shadow: 0 0 0 2px ${token.magicColorUsages.primary.default}1a;
		`,
		label: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[3]};
		`,
		value: css`
			font-size: 13px;
			color: ${token.magicColorUsages.text[1]};
			word-break: break-all;
		`,
		name: css`
			font-size: 14px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[1]};
		`,
		capabilityTag: css`
			margin: 0;
			display: inline-flex;
			align-items: center;
			gap: 4px;
		`,
		timeRow: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[3]};
			flex-shrink: 0;
		`,
		expandBtn: css`
			display: inline-flex;
			align-items: center;
			gap: 4px;
			font-size: 12px;
			color: ${token.magicColorUsages.primary.default};
			cursor: pointer;
			user-select: none;
			width: fit-content;

			&:hover {
				opacity: 0.85;
			}
		`,
		detailWrap: css`
			padding-top: 8px;
			margin-top: 4px;
			border-top: 1px dashed ${token.magicColorUsages.border};
		`,
		section: css`
			&:not(:last-child) {
				margin-bottom: 10px;
			}
		`,
		sectionTitle: css`
			font-size: 12px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[2]};
			margin-bottom: 6px;
		`,
		detailRow: css`
			display: grid;
			grid-template-columns: 96px 1fr;
			gap: 4px 8px;
			align-items: start;

			&:not(:last-child) {
				margin-bottom: 4px;
			}
		`,
		iconPreview: css`
			width: 32px;
			height: 32px;
			border-radius: 8px;
			object-fit: cover;
			border: 1px solid ${token.magicColorUsages.border};
		`,
		multiline: css`
			white-space: pre-wrap;
			line-height: 1.5;
		`,
	}
})

const isIconUrl = (value: string) => /^https?:\/\//i.test(value)

const DetailFieldRow = ({
	field,
	styles,
}: {
	field: ImportSourceDetailField
	styles: ReturnType<typeof useStyles>["styles"]
}) => {
	if (field.type === "icon" && field.value !== "-") {
		return (
			<div className={styles.detailRow}>
				<div className={styles.label}>{field.label}</div>
				{isIconUrl(field.value) ? (
					<img className={styles.iconPreview} src={field.value} alt="" />
				) : (
					<div className={styles.value}>{field.value}</div>
				)}
			</div>
		)
	}

	return (
		<div className={styles.detailRow}>
			<div className={styles.label}>{field.label}</div>
			<div
				className={
					field.type === "multiline"
						? `${styles.value} ${styles.multiline}`
						: styles.value
				}
			>
				{field.value}
			</div>
		</div>
	)
}

const ImportSourceCard = ({ source, isSelected, onSelect }: ImportSourceCardProps) => {
	const { t } = useTranslation("admin/ai/model")
	const { styles, cx } = useStyles()
	const [expanded, setExpanded] = useState(false)

	const detailSections = useMemo(() => getImportSourceDetailSections(source, t), [source, t])

	const hasDetails = detailSections.some((section) => section.fields.length > 0)

	const toggleExpand = (e: React.MouseEvent) => {
		e.stopPropagation()
		setExpanded((prev) => !prev)
	}

	return (
		<Flex
			vertical
			gap={8}
			className={cx(styles.card, isSelected && styles.cardSelected)}
			onClick={onSelect}
		>
			<Flex justify="space-between" gap={12} align="flex-start">
				<Flex vertical gap={2} flex={1}>
					<div className={styles.label}>{t("form.importProvider")}</div>
					<div className={styles.name}>{getImportSourceProviderName(source)}</div>
				</Flex>
				<Flex align="center" gap={4} className={styles.timeRow}>
					<IconClock size={14} />
					<span>
						{source.created_at
							? dayjs(source.created_at).format("YYYY-MM-DD HH:mm")
							: t("form.noUpdatedAt")}
					</span>
				</Flex>
			</Flex>

			<Flex vertical gap={2}>
				<div className={styles.label}>{t("form.modelName")}</div>
				<div className={styles.value}>{source.model_version || "-"}</div>
			</Flex>

			<Flex vertical gap={2}>
				<div className={styles.label}>{t("form.modelDisplayName")}</div>
				<div className={styles.value}>{source.name || "-"}</div>
			</Flex>

			<Flex vertical gap={2}>
				<div className={styles.label}>{t("form.modelId")}</div>
				<div className={styles.value}>{source.model_id || "-"}</div>
			</Flex>

			<Flex gap={6} wrap>
				{source.config.support_multi_modal && (
					<Tag className={styles.capabilityTag}>
						<IconEyeSpark size={14} />
						{t("form.supportVision")}
					</Tag>
				)}
				{source.config.support_function && (
					<Tag className={styles.capabilityTag}>
						<IconTools size={14} />
						{t("form.supportTool")}
					</Tag>
				)}
				{source.config.support_deep_think && (
					<Tag className={styles.capabilityTag}>
						<IconTopologyStarRing3 size={14} />
						{t("form.supportThink")}
					</Tag>
				)}
			</Flex>

			{hasDetails && (
				<>
					<div
						className={styles.expandBtn}
						onClick={toggleExpand}
						role="button"
						tabIndex={0}
					>
						{expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
						{expanded ? t("form.collapseImportDetails") : t("form.expandImportDetails")}
					</div>

					{expanded && (
						<div className={styles.detailWrap} onClick={(e) => e.stopPropagation()}>
							{detailSections.map((section) => (
								<div key={section.key} className={styles.section}>
									<div className={styles.sectionTitle}>{section.title}</div>
									{section.fields.map((field) => (
										<DetailFieldRow
											key={field.key}
											field={field}
											styles={styles}
										/>
									))}
								</div>
							))}
						</div>
					)}
				</>
			)}
		</Flex>
	)
}

export default memo(ImportSourceCard)
