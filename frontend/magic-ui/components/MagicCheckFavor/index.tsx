import { HTMLAttributes, useEffect, useMemo, useState } from "react"
import { useStyles } from "./style"

export type MagicCheckFavorProps = {
	onChange?: (checked: boolean) => void
	checked?: boolean
} & HTMLAttributes<HTMLDivElement>

const genRandomId = () => {
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

function MagicCheckFavor({ checked, onChange, className, ...props }: MagicCheckFavorProps) {
	const { styles, cx } = useStyles()

	const checkId = useMemo(() => genRandomId(), [])

	const [checkedComp, setCheckedComp] = useState(checked)

	useEffect(() => {
		setCheckedComp(checked)
	}, [checked])

	return (
		<div className={cx(styles.checkBox, className)} {...props}>
			<input
				onChange={(e) => {
					setCheckedComp(e.target.checked)
					onChange?.(e.target.checked)
				}}
				checked={checkedComp}
				className={cx(styles.checkBoxInput, checkedComp && styles.checkBoxInputChecked)}
				type="checkbox"
				id={`checkBoxInput_${checkId}`}
			/>
			<label htmlFor={`checkBoxInput_${checkId}`} className={styles.checkBoxLabel} />
		</div>
	)
}

MagicCheckFavor.displayName = "MagicCheckFavor"

export default MagicCheckFavor
