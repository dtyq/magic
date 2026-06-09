import { memo } from "react"
import { Flex, Form } from "antd"
import { useTranslation } from "react-i18next"
import { MagicInputNumber } from "@admin-components"
import type { NormalizedGenericPricingGroup } from "../../AddModelModal/pricingTemplate"
import { useStyles } from "../styles"

interface GenericPricingSectionProps {
	groups: NormalizedGenericPricingGroup[]
	addonBefore: string
}

const GenericPricingSection = memo(({ groups, addonBefore }: GenericPricingSectionProps) => {
	const { t } = useTranslation("admin/ai/model")
	const { styles } = useStyles()

	return (
		<Flex vertical gap={12}>
			{groups.map((group, groupIndex) => (
				<Flex
					key={group.groupLabelKey ?? groupIndex}
					vertical
					gap={10}
					className={styles.pricingGroup}
				>
					{group.groupLabelKey && (
						<div className={styles.pricingGroupTitle}>{t(group.groupLabelKey)}</div>
					)}
					{group.rows.map((row) => (
						<div key={row.key} className={styles.pricingRow}>
							<div className={styles.pricingRowMeta}>
								<div className={styles.pricingRowTitle}>{row.displayLabel}</div>
							</div>
							<div className={styles.pricingInputGrid}>
								{row.priceField && (
									<Flex vertical gap={4}>
										<div className={styles.pricingInputLabel}>
											{row.priceLabel ?? t("form.unitPrice")}
										</div>
										<Form.Item
											name={["config", row.priceField]}
											style={{ marginBottom: 0 }}
										>
											<MagicInputNumber
												placeholder={t("form.pleaseInputPrice")}
												style={{ width: "100%" }}
												addonBefore={addonBefore}
												addonAfter={t(row.unitKey)}
												min={0}
												stringMode
											/>
										</Form.Item>
									</Flex>
								)}
								{row.costField && (
									<Flex vertical gap={4}>
										<div className={styles.pricingInputLabel}>
											{row.costLabel ?? t("form.costPrice")}
										</div>
										<Form.Item
											name={["config", row.costField]}
											style={{ marginBottom: 0 }}
										>
											<MagicInputNumber
												placeholder={t("form.pleaseInputPrice")}
												style={{ width: "100%" }}
												addonBefore={addonBefore}
												addonAfter={t(row.unitKey)}
												min={0}
												stringMode
											/>
										</Form.Item>
									</Flex>
								)}
							</div>
						</div>
					))}
				</Flex>
			))}
		</Flex>
	)
})

export default GenericPricingSection
