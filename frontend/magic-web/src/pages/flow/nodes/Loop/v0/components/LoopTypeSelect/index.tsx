import { Icon123, IconBrackets, IconEqual } from "@tabler/icons-react"
import { cx } from "antd-style"
import i18next from "i18next"
import styles from "./index.module.less"

// eslint-disable-next-line react-refresh/only-export-components
export enum LoopTypes {
	// 计数
	Count = "count",
	// 循环数组
	Array = "array",
	// 设置终止条件
	Condition = "condition",
}

const loopTypeList = [
	{
		label: i18next.t("loop.arrayLoop", { ns: "flow" }),
		value: LoopTypes.Array,
		icon: IconBrackets,
	},
	{
		label: i18next.t("loop.countLoop", { ns: "flow" }),
		value: LoopTypes.Count,
		icon: Icon123,
	},
	{
		label: i18next.t("loop.conditionsLoop", { ns: "flow" }),
		value: LoopTypes.Condition,
		icon: IconEqual,
	},
]

type LoopTypeSelectProps = {
	value?: LoopTypes
	onChange?: (value: LoopTypes) => void
}

export default function LoopTypeSelect({ value, onChange }: LoopTypeSelectProps) {
	return (
		<div className={styles.loopTypeSelect}>
			{loopTypeList.map((loopTypeOption) => {
				const IconComponent = loopTypeOption.icon
				return (
					<div
						className={cx(styles.loopTypeCard, {
							[styles.active]: value === loopTypeOption.value,
						})}
						onClick={() => onChange?.(loopTypeOption.value)}
						key={loopTypeOption.value}
					>
						<IconComponent stroke={2} width={20} className={styles.icon} />
						<span className={styles.text}>{loopTypeOption.label}</span>
					</div>
				)
			})}
		</div>
	)
}
