import React from "react"
import { Flex, Input } from "antd"
import { IconSearch } from "@tabler/icons-react"

import { useDirectoryStyles } from "../styles"

interface SearchBarProps {
	value: string
	placeholder: string
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
	onCompositionStart: () => void
	onCompositionEnd: (e: React.CompositionEvent<HTMLInputElement>) => void
	isMobile?: boolean
}

function SearchBar({
	value,
	placeholder,
	onChange,
	onCompositionStart,
	onCompositionEnd,
	isMobile = false,
}: SearchBarProps) {
	const { styles } = useDirectoryStyles({ isMobile })

	return (
		<Flex className={styles.searchContainer}>
			<Input
				value={value}
				className={styles.searchInput}
				onChange={onChange}
				onCompositionStart={onCompositionStart}
				onCompositionEnd={onCompositionEnd}
				placeholder={placeholder}
				prefix={<IconSearch size={16} className={styles.searchIcon} />}
			/>
		</Flex>
	)
}

export default SearchBar
