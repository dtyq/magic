import { IconSearch } from "@tabler/icons-react"
import React, { ReactNode } from "react"
import TsInput from "../../Input"
import styles from "./index.module.less"

type SearchInput = {
	prefix?: ReactNode
	placeholder?: string
	value?: string
	onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
	refInstance?: React.MutableRefObject<HTMLInputElement | undefined>
	[key: string]: any
}

export default function SearchInput({
	prefix,
	placeholder,
	value,
	onChange,
	refInstance,
	...props
}: SearchInput) {
	return (
		<TsInput
			prefix={prefix || <IconSearch color="#b0b0b2" size={18} stroke={2} />}
			placeholder={placeholder}
			value={value}
			onChange={onChange}
			ref={refInstance}
			className={styles.searchInput}
			{...props}
		/>
	)
}
