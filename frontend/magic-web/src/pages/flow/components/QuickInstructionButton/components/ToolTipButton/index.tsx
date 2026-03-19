import { useTranslation } from "react-i18next"
import { memo, useMemo } from "react"
import { Flex, Popover } from "antd"
import MagicButton from "@/components/base/MagicButton"
import { IconInfoCircle, IconTooltip } from "@tabler/icons-react"
import ExampleImg from "@/assets/resources/exampleImg.png"
import { useBoolean } from "ahooks"
import type { InstructionExplanation as InstructionExplanationType } from "@/types/bot"
import { useStyles } from "./styles"
import { InstructionExplanation } from "./components/InstructionExplanation"

interface TooltipBtnProps {
	initialValues?: InstructionExplanationType
	type: "button" | "icon"
	onFinish: (val: InstructionExplanationType) => void
}

export const ToolTipButton = memo(({ initialValues, type, onFinish }: TooltipBtnProps) => {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()

	const [open, { setTrue, setFalse }] = useBoolean(false)

	const subContent = useMemo(() => {
		return (
			<Flex vertical gap={8}>
				<div className={styles.example}>{t("explore.form.example")}</div>
				<img src={ExampleImg} alt="example" className={styles.exampleImg} />
				<Flex vertical gap={4}>
					<div className={styles.exampleTitle}>{t("explore.form.exampleTitle")}</div>
					<div className={styles.exampleDesc}>{t("explore.form.exampleDesc")}</div>
				</Flex>
			</Flex>
		)
	}, [styles.example, styles.exampleDesc, styles.exampleImg, styles.exampleTitle, t])

	const title = useMemo(() => {
		return (
			<Flex gap={4} align="center">
				<div className={styles.title}>{t("explore.form.instructionExplanation")}</div>
				<Popover
					placement="right"
					title=""
					content={subContent}
					arrow
					overlayStyle={{ width: 160 }}
				>
					<IconInfoCircle size={18} className={styles.exampleDesc} />
				</Popover>
			</Flex>
		)
	}, [styles.exampleDesc, styles.title, subContent, t])

	return (
		<Popover
			placement="top"
			open={open}
			arrow
			title={title}
			destroyTooltipOnHide
			content={
				<InstructionExplanation
					initialValues={initialValues}
					onFinish={onFinish}
					onClose={setFalse}
				/>
			}
		>
			{type === "icon" ? (
				<MagicButton
					type="text"
					className={styles.button}
					onClick={setTrue}
					icon={<IconTooltip size={16} />}
				/>
			) : (
				<MagicButton
					type="text"
					className={styles.button}
					onClick={setTrue}
					icon={<IconTooltip size={16} />}
					style={{ width: 100 }}
				>
					{t("explore.form.instructionExplanation")}
				</MagicButton>
			)}
		</Popover>
	)
})
