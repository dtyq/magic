import type { MagicModalProps } from "components"
import { MagicInput, MagicModal } from "components"
import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Empty, Flex, Tooltip } from "antd"
import { debounce } from "lodash-es"
import type { OpenableProps } from "@/hooks/useOpenModal"
import { useStyles } from "./styles"
import type { IconInfo } from "../../utils"
import { getAllIcons, IconComponent } from "../../utils"

interface IconSelectModalProps extends OpenableProps<MagicModalProps> {
	/* 选中的图标名 */
	selectedIcon: string | undefined
	/* 选择图标 */
	handleIconSelect: (iconName: string) => void
	/* 选中后是否自动关闭弹窗，默认 false */
	closeOnSelect?: boolean
}

const IconSelectModal = ({
	selectedIcon,
	handleIconSelect,
	closeOnSelect = false,
	onClose,
	...props
}: IconSelectModalProps) => {
	const { t } = useTranslation("admin/platform/mode")
	const { styles, cx } = useStyles()

	const [open, setOpen] = useState(true)
	const [allIcons, setAllIcons] = useState<IconInfo[]>([])
	const [displayedIcons, setDisplayedIcons] = useState<IconInfo[]>([])
	const [page, setPage] = useState(1)
	const [hasMore, setHasMore] = useState(true)
	const [loading, setLoading] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const PAGE_SIZE = 100

	// 获取所有图标信息
	useEffect(() => {
		const icons = getAllIcons()
		setAllIcons(icons)
		setDisplayedIcons(icons.slice(0, PAGE_SIZE))
	}, [])

	const onCancel = () => {
		setOpen(false)
		onClose?.()
	}

	// 滚动加载更多
	const loadMoreIcons = () => {
		if (loading || !hasMore || searchValue) return

		setLoading(true)
		setTimeout(() => {
			const startIndex = page * PAGE_SIZE
			const endIndex = startIndex + PAGE_SIZE
			const newIcons = allIcons.slice(startIndex, endIndex)

			if (newIcons.length > 0) {
				setDisplayedIcons((prev) => [...prev, ...newIcons])
				setPage((prev) => prev + 1)
			}

			setHasMore(endIndex < allIcons.length)
			setLoading(false)
		}, 100)
	}

	// 处理滚动事件
	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
		if (scrollHeight - scrollTop <= clientHeight * 1.1) {
			loadMoreIcons()
		}
	}

	const debounceSearch = useMemo(
		() =>
			debounce((value: string) => {
				setSearchValue(value)
			}, 500),
		[],
	)

	const filterIcons = useMemo(() => {
		if (!searchValue) return displayedIcons

		const searchLower = searchValue.toLowerCase()
		return allIcons.filter((icon) => {
			// 按图标名称搜索
			const nameMatch = icon.name.toLowerCase().includes(searchLower)
			// 按tags搜索
			const tagMatch =
				!!icon.tags.length &&
				icon.tags.some((tag) => tag?.toLowerCase?.().includes(searchLower))

			return nameMatch || tagMatch
		})
	}, [allIcons, displayedIcons, searchValue])

	return (
		<MagicModal
			centered
			open={open}
			title={t("selectIcon")}
			height={400}
			footer={null}
			zIndex={10002}
			classNames={{
				body: styles.body,
			}}
			afterClose={() => {
				setSearchValue("")
			}}
			onCancel={onCancel}
			{...props}
		>
			<div style={{ padding: "10px 10px 0 10px" }}>
				<MagicInput
					placeholder={t("searchIcon")}
					onChange={(e) => debounceSearch(e.target.value)}
					allowClear
				/>
			</div>
			{filterIcons?.length ? (
				<div className={styles.content} onScroll={handleScroll}>
					{filterIcons?.map((iconInfo) => {
						const { name: iconName } = iconInfo
						const isSelected = selectedIcon === iconName

						return (
							<Tooltip title={iconName} key={iconName}>
								<Flex
									align="center"
									justify="center"
									className={cx(
										styles.iconItem,
										isSelected && styles.selectedIcon,
									)}
									onClick={() => {
										handleIconSelect(iconName)
										if (closeOnSelect) {
											setOpen(false)
											onClose?.()
										}
									}}
								>
									{IconComponent(iconName, 24, "currentColor")}
								</Flex>
							</Tooltip>
						)
					})}
				</div>
			) : (
				<Empty description={t("noIconsFound")} style={{ margin: "50px auto" }} />
			)}
		</MagicModal>
	)
}

export default IconSelectModal
