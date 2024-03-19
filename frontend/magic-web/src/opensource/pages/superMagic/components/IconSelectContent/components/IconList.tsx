import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Empty } from "antd"
import { useIconListStyles } from "../styles"
import { TablerIcon } from "@/opensource/utils/tablerIconLoader"
import { Icon, toUpperCamelCase } from ".."
import { MagicInput, MagicSpin } from "@/opensource/components/base"
import { IconSearch } from "@tabler/icons-react"
import { useDebounceFn } from "ahooks"
import { colorUsages } from "@/opensource/providers/ThemeProvider/colors"

interface IconListProps {
	icons: Icon[]
	selectedColor: string
	localSelectedIcon: string
	setLocalSelectedIcon: (iconName: string) => void
}

const IconList = ({
	icons,
	selectedColor,
	localSelectedIcon,
	setLocalSelectedIcon,
}: IconListProps) => {
	const { t, i18n } = useTranslation("super")
	const { styles, cx } = useIconListStyles({ color: selectedColor })

	const language = i18n.language

	const [loading, setLoading] = useState(false)
	const [searchValue, setSearchValue] = useState("")

	const filteredIcons = useMemo(() => {
		if (!searchValue) return icons
		return icons.filter(({ name, nameEn }) => {
			if (language === "en_US") {
				return nameEn.toLowerCase().includes(searchValue.toLowerCase())
			}
			return name.toLowerCase().includes(searchValue.toLowerCase())
		})
	}, [icons, searchValue, language])

	const { run: debouncedSearch } = useDebounceFn(
		(value: string) => {
			setSearchValue(value)
			setLoading(false)
		},
		{ wait: 300 },
	)

	function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
		setLoading(true)
		debouncedSearch(e.target.value)
	}

	return (
		<div className={styles.iconSection}>
			<MagicInput
				onChange={handleInputChange}
				placeholder={t("agentEditor.configPanel.searchIcon")}
				prefix={<IconSearch size={16} color={colorUsages.text[3]} />}
				allowClear
				className={styles.search}
			/>
			<MagicSpin spinning={loading}>
				<div className={styles.content}>
					{!loading && filteredIcons.length === 0 && (
						<Empty
							description={t("agentEditor.configPanel.noIconsFound")}
							className={styles.empty}
						/>
					)}
					{filteredIcons.length > 0 &&
						filteredIcons.map(({ icon, name, nameEn }) => {
							const IconName = toUpperCamelCase(icon)
							const isSelected = localSelectedIcon === IconName
							return (
								<div
									key={icon}
									className={cx(
										styles.iconItem,
										isSelected && styles.selectedIcon,
									)}
									onClick={() => setLocalSelectedIcon(IconName)}
								>
									<TablerIcon
										name={IconName}
										size={24}
										color={isSelected ? selectedColor : "currentColor"}
										stroke={2}
									/>
									{language === "en_US" ? (
										<span
											style={{
												fontSize: nameEn.length > 12 ? "8px" : "10px",
											}}
										>
											{nameEn}
										</span>
									) : (
										<span>{name}</span>
									)}
								</div>
							)
						})}
				</div>
			</MagicSpin>
		</div>
	)
}

export default IconList
