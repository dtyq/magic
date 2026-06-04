import { memo } from "react"
import { Flex, Form } from "antd"
import { useTranslation } from "react-i18next"
import { MagicButton, MagicInputNumber } from "@admin-components"
import { IconPlus, IconTrash } from "@tabler/icons-react"
import { useStyles } from "../styles"

interface PricingStepItemProps {
	/* 字段列表 */
	fields: Array<{ key: React.Key; name: number }>
	/* 添加一档 */
	onAddStep: (index: number) => void
	/* 删除一档 */
	onRemoveStep: (listIndex: number) => void
	/* 源定价步长 */
	sourcePricingSteps: Array<{ max?: number | string | null }>
	enabled: boolean
	/* 是否为跟随模式 */
	isFollowMode: boolean
	/* 是否为阶梯模式 */
	isLadder: boolean
	/* 前缀 */
	addonBefore: string
	/* 价格规则 */
	priceRules: Array<{ required: boolean; message: string }>
}

const PricingStepItem = memo(
	({
		fields,
		onAddStep,
		onRemoveStep,
		sourcePricingSteps,
		enabled,
		isFollowMode,
		isLadder,
		addonBefore,
		priceRules,
	}: PricingStepItemProps) => {
		const { t } = useTranslation("admin/ai/model")
		const { styles } = useStyles()

		return (
			<Flex vertical gap={6}>
				{fields.map((stepField, index) => {
					const isLast = index === fields.length - 1
					const startValue = index === 0 ? 0 : sourcePricingSteps[index - 1]?.max
					const endValue = isLast ? t("form.noLimit") : sourcePricingSteps[index]?.max
					const maxRules =
						enabled && !isFollowMode && index !== fields.length - 1
							? [{ required: true, message: "" }]
							: []

					return (
						<Flex key={stepField.key} gap={6} align="center">
							<MagicInputNumber
								className={styles.pricingBoundaryInput}
								disabled
								value={startValue}
								addonAfter="K"
								min={0}
							/>
							<div className={styles.tokenRangeText}>{"<= Token <="}</div>
							{isFollowMode ? (
								<MagicInputNumber
									className={styles.pricingBoundaryInput}
									disabled
									value={endValue}
									addonAfter="K"
									min={0}
								/>
							) : (
								<Form.Item
									name={[stepField.name, "max"]}
									style={{ marginBottom: 0 }}
									rules={maxRules}
								>
									<MagicInputNumber
										className={styles.pricingBoundaryInput}
										placeholder={
											isLast
												? t("form.noLimit")
												: t("form.tokenRangeUpperBoundPlaceholder")
										}
										disabled={!enabled || isLast}
										addonAfter="K"
										min={0}
										precision={0}
									/>
								</Form.Item>
							)}
							<Form.Item
								name={[stepField.name, "price"]}
								style={{ marginBottom: 0, flex: 1 }}
								rules={priceRules}
							>
								<MagicInputNumber
									className={styles.pricingValueInput}
									placeholder={t("form.pleaseInputPrice")}
									disabled={!enabled}
									addonBefore={addonBefore}
									addonAfter={t("millionTokens")}
									min={0}
									stringMode
								/>
							</Form.Item>
							{isLadder && (
								<>
									<MagicButton
										className={styles.pricingActionButton}
										icon={<IconPlus size={16} />}
										disabled={!enabled}
										onClick={() => onAddStep(index)}
									/>
									<MagicButton
										className={styles.pricingActionButton}
										icon={<IconTrash size={16} />}
										disabled={!enabled || fields.length <= 1}
										onClick={() => onRemoveStep(stepField.name)}
									/>
								</>
							)}
						</Flex>
					)
				})}
			</Flex>
		)
	},
)

export default PricingStepItem
