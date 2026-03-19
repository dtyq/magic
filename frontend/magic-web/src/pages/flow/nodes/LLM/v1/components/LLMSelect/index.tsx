import type { SelectProps } from "antd"
import { IconAdjustmentsHorizontal, IconChevronDown } from "@tabler/icons-react"
import { cx } from "antd-style"
import MagicSelect from "@/pages/flow/components/MagicSelect"
import MagicIcon from "@/components/base/MagicIcon"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { LLMLabelTagType } from "./LLMLabel"
import LLMLabel from "./LLMLabel"
import styles from "./index.module.less"
import RenderLabelCommon from "@/pages/flow/components/RenderLabel/RenderLabel"

export type LLMOption = {
	value: string
	label: string
	tags: {
		type: LLMLabelTagType
		value: string
	}[]
	icon: string
}

interface LLMSelectProps extends SelectProps {
	value?: string | number | boolean | null | undefined
	onChange?: (val: string | number | boolean | null | undefined) => void
	options: LLMOption[]
	className?: string
	dropdownRenderProps?: object
	placeholder?: string
	showLLMSuffixIcon?: boolean
}

export default function LLMSelectV0({
	value,
	onChange,
	options,
	className,
	dropdownRenderProps,
	showLLMSuffixIcon,
	...props
}: LLMSelectProps) {
	const { t } = useTranslation()
	const showOptions = useMemo(() => {
		return options.map((option) => {
			return {
				...option,
				label: (
					<LLMLabel
						label={option.label}
						tags={option.tags}
						value={option.value}
						icon={option.icon}
						selectedValue={value}
						showCheck={false}
					/>
				),
				realLabel: option.label,
			}
		})
	}, [options, value])

	return (
		<MagicSelect
			{...props}
			className={cx(styles.LLMSelect, className)}
			options={showOptions}
			value={value}
			onChange={onChange}
			dropdownRenderProps={
				dropdownRenderProps || {
					placeholder: t("common.searchModel", { ns: "flow" }),
				}
			}
			suffixIcon={
				showLLMSuffixIcon ? (
					<div className={styles.suffixIcon}>
						<MagicIcon component={IconAdjustmentsHorizontal} size={16} />
						<MagicIcon component={IconChevronDown} size={16} />
					</div>
				) : null
			}
			labelRender={(props: any) => {
				if (!props.value) return undefined
				if (!props.label) {
					return <RenderLabelCommon name={t("llm.invalidModel", { ns: "flow" })} danger />
				}

				return props.label
			}}
		/>
	)
}
