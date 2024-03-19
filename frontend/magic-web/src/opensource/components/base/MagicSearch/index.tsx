import { IconSearch } from "@tabler/icons-react"
import type { InputProps, InputRef } from "antd"
import { Input } from "antd"
import { cx } from "antd-style"
import { useTranslation } from "react-i18next"
import { forwardRef, useState, memo } from "react"
import type { CompositionEvent, ChangeEvent } from "react"
import MagicIcon from "../MagicIcon"
import { useSearchStyles } from "./style"

const MagicSearch = memo(
	forwardRef<InputRef, InputProps>(({ className, onChange, value, ...props }, ref) => {
		const { styles } = useSearchStyles()
		const { t } = useTranslation("interface")

		const [rawValue, setRawValue] = useState(value)
		const [isComposing, setIsComposing] = useState(false)

		return (
			<Input
				ref={ref}
				value={rawValue}
				onCompositionStart={() => setIsComposing(true)}
				onCompositionEnd={(e: CompositionEvent<HTMLInputElement>) => {
					setIsComposing(false)
					// 在输入法结束时触发一次onChange
					onChange?.(e as unknown as ChangeEvent<HTMLInputElement>)
				}}
				onChange={(e) => {
					// 只在非输入法编辑状态下触发
					setRawValue(e.target.value)
					if (!isComposing) {
						onChange?.(e)
					}
				}}
				className={cx(styles.search, className)}
				placeholder={t("search")}
				prefix={<MagicIcon component={IconSearch} size={20} color="currentColor" />}
				{...props}
			/>
		)
	}),
)

export default MagicSearch
