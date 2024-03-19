import { useState } from "react"
import { useMagicRadioFavorStyle } from "./useMagicRadioFavorStyle"

interface Option {
	label: string
	value: any
}

type Props = {
	options?: Option[]
	onChange?: Function
	selectedValue?: any
	value: any
}

export default function MagicRadioFavor({ options, onChange, selectedValue, value }: Props) {
	const [activeRadio, setActiveRadio] = useState<number>(value)

	const { styles, cx } = useMagicRadioFavorStyle()
	const handleChange = (changeValue: any) => {
		console.log(selectedValue)
		if (onChange) {
			onChange(changeValue)
		}
	}
	const onClick = (changeValue: any) => {
		setActiveRadio(changeValue)
		handleChange(changeValue)
	}
	return (
		<div className={styles.magicRadioFavor}>
			{options &&
				options.map((option) => (
					<div
						className={cx(styles.radioItem, {
							[styles.active]: activeRadio === option.value,
						})}
						onClick={() => {
							onClick(option.value)
						}}
					>
						{option.label}
					</div>
				))}
		</div>
	)
}
