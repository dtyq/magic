import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Tabs } from "antd"
import { useStyles } from "./styles"
import { addAlphaToHex } from "@/opensource/utils/color"
import DragUpload from "./components/DragUpload"
import IconList from "./components/IconList"
import { IconType } from "../AgentSelector/types"
import { TablerIcon } from "@/opensource/utils/tablerIconLoader"
import { useMemoizedFn, useMount } from "ahooks"
import { useImmer } from "use-immer"

const loadClassification = () =>
	import("./tabler-icons-classification.json").then((mod) => mod.default)

export interface Selection {
	type: string
	color: string
	url: string
	icon_type: IconType
}

interface IconSelectModalProps {
	/* 选中的图标信息 */
	selectedIcon: { type: string; color: string; url: string }
	/* 图标类型 */
	iconType: IconType
	onSelect: (selectedIcon: Selection) => void
}

// 预定义颜色
const colors = ["#315CEC", "#00BF9A", "#FF7D00", "#FFC900", "#FF0974", "#6431E5"]
const bgColors = colors.map((color) => addAlphaToHex(color, 0.1))

export interface Icon {
	icon: string
	name: string
	nameEn: string
}

interface Category {
	id: string
	name: string
	nameEn: string
	icon: string
	icons: Icon[]
}

export const toUpperCamelCase = (str: string) => {
	return str
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("")
}

const IconSelectContent = ({ selectedIcon, onSelect, iconType }: IconSelectModalProps) => {
	const { t, i18n } = useTranslation("super")
	const { styles, cx } = useStyles()

	const language = i18n.language

	const [categories, setCategories] = useState<Category[]>([])
	const [activeTab, setActiveTab] = useState<string>("symbols")
	const [localSelection, setLocalSelection] = useImmer<Selection>(() => ({
		type: selectedIcon?.type,
		color: selectedIcon?.color,
		url: selectedIcon?.url,
		icon_type: iconType,
	}))

	// 图标类型
	const isSelectIconType = activeTab !== "upload"

	const onInnerSelect = (selection: Partial<Selection>) => {
		onSelect?.({
			...localSelection,
			...selection,
		})
		setLocalSelection((draft) => ({
			...draft,
			...selection,
		}))
	}

	useMount(() => {
		loadClassification().then((mod) => {
			setCategories(mod.categories)
		})
	})

	const items = useMemo(() => {
		return categories
			.map((category) => ({
				key: category.id,
				label: language === "en_US" ? category.nameEn : category.name,
				icon: <TablerIcon name={toUpperCamelCase(category.icon)} size={16} stroke={2.5} />,
				children: (
					<IconList
						icons={category.icons}
						selectedColor={localSelection.color}
						localSelectedIcon={localSelection.type}
						setLocalSelectedIcon={(type: string) => onInnerSelect({ type })}
					/>
				),
			}))
			.concat([
				{
					key: "upload",
					label: t("agentEditor.configPanel.uploadImage"),
					icon: <TablerIcon name="IconUpload" size={16} stroke={2.5} />,
					children: (
						<DragUpload
							bgColor={localSelection.color}
							imagePreviewUrl={localSelection.url}
							setImagePreviewUrl={(url: string) => onInnerSelect({ url })}
						/>
					),
				},
			])
	}, [language, categories, localSelection])

	useEffect(() => {
		setActiveTab(iconType == IconType.Image ? "upload" : "symbols")
		if (selectedIcon.color) {
			setLocalSelection((draft) => {
				draft.color = selectedIcon.color
			})
		}
		if (selectedIcon.url) {
			setLocalSelection((draft) => {
				draft.url = selectedIcon.url
			})
		}
		if (selectedIcon.type) {
			setLocalSelection((draft) => {
				draft.type = selectedIcon.type
			})
			const IconTab = categories.find((category) =>
				category.icons.some((icon) => toUpperCamelCase(icon.icon) === selectedIcon.type),
			)
			if (IconTab && iconType !== IconType.Image) {
				setActiveTab(IconTab.id)
			}
		}
	}, [iconType, selectedIcon, categories])

	const onChangeTab = useMemoizedFn((key: string) => {
		setActiveTab(key)
		if (key === "upload") {
			setLocalSelection((draft) => {
				draft.color = bgColors.includes(draft.color) ? draft.color : bgColors[0]
				draft.icon_type = IconType.Image
			})
		} else {
			setLocalSelection((draft) => {
				draft.color = colors.includes(draft.color) ? draft.color : colors[0]
				draft.icon_type = IconType.Icon
			})
		}
	})

	return (
		<div className={styles.modalContent}>
			<Tabs
				className={styles.tabs}
				popupClassName={styles.tabsPopup}
				activeKey={activeTab}
				onChange={onChangeTab}
				items={items}
			/>

			<div className={styles.colorSection}>
				<span>
					{isSelectIconType
						? t("agentEditor.configPanel.iconColor")
						: t("agentEditor.configPanel.backgroundColor")}
				</span>
				{colors.map((color, index) => {
					const currentColor = isSelectIconType ? color : bgColors[index]
					const boxShadowColor = isSelectIconType
						? addAlphaToHex(color, 0.5)
						: addAlphaToHex(color, 1)
					return (
						<div
							key={color}
							className={cx(styles.colorItem)}
							style={{
								backgroundColor: currentColor,
								...(localSelection.color === currentColor && {
									boxShadow: `0 0 0 2px ${boxShadowColor}`,
								}),
							}}
							onClick={() => onInnerSelect({ color: currentColor })}
							title={color}
						/>
					)
				})}
			</div>
		</div>
	)
}

export default IconSelectContent
