import { Flex, Input, Select, Spin } from "antd"
import { useTranslation } from "react-i18next"
import { useState, useMemo } from "react"
import { useProjects } from "./hooks/useProjects"
import { LongMemory } from "@/types/longMemory"
import useStyles from "./styles"

export default function TextSource({
	editMemory,
	memoryContent,
	setMemoryContent,
	selectedProjectId,
	setSelectedProjectId,
}: {
	editMemory: LongMemory.Memory | undefined
	memoryContent?: string
	setMemoryContent: (content: string) => void
	selectedProjectId: string | undefined
	setSelectedProjectId: (projectId: string | undefined) => void
}) {
	const { styles } = useStyles()
	const { t } = useTranslation("super/longMemory")

	/** 记忆归属 */
	const [memoryBelong, setMemoryBelong] = useState<string>("global")

	// 获取项目数据
	const { groupedOptions, loading, hasMore, error, loadMore, searchValue, searchProjects } =
		useProjects()

	// 构建最终的选项列表
	const selectOptions = useMemo(() => {
		const baseOptions = [
			{
				label: t("globalMemory"),
				value: "global",
			},
		]

		if (groupedOptions.length > 0) {
			return [...baseOptions, ...groupedOptions]
		}

		return baseOptions
	}, [t, groupedOptions])

	// 处理项目选择变化
	const handleProjectChange = (value: string) => {
		if (value === "global") {
			setMemoryBelong("global")
			setSelectedProjectId(undefined)
		} else {
			setMemoryBelong("project")
			setSelectedProjectId(value)
		}
	}

	// 处理下拉框滚动
	const handlePopupScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const { target } = e
		const element = target as HTMLDivElement

		// 当滚动到底部附近时加载更多
		if (element.scrollTop + element.offsetHeight >= element.scrollHeight - 10) {
			if (hasMore && !loading) {
				loadMore()
			}
		}
	}

	// 自定义下拉菜单内容，在底部添加加载状态
	const dropdownRender = (menu: React.ReactElement) => (
		<>
			{menu}
			{loading && (
				<div className={styles.loadingContainer}>
					<Spin size="small" />
				</div>
			)}
		</>
	)

	const currentValue = useMemo(() => {
		return memoryBelong === "global" ? "global" : selectedProjectId
	}, [memoryBelong, selectedProjectId])

	return (
		<div className={styles.wrapper}>
			{!editMemory && (
				<Flex vertical gap={10}>
					<div className={styles.header}>{t("memoryBelong")}</div>
					<Select
						placeholder={t("memoryBelong")}
						options={selectOptions}
						value={currentValue}
						onChange={handleProjectChange}
						onPopupScroll={handlePopupScroll}
						dropdownRender={dropdownRender}
						showSearch
						searchValue={searchValue}
						onSearch={searchProjects}
						filterOption={false}
						notFoundContent={loading ? <Spin size="small" /> : t("noData")}
					/>
					{error && <div className={styles.errorText}>{error}</div>}
				</Flex>
			)}
			<Flex flex={1} vertical gap={10}>
				<div className={styles.header}>{t("memoryContent")}</div>
				<div className={styles.container}>
					<Input.TextArea
						autoFocus={true}
						rootClassName={styles.input}
						placeholder={t("textContentPlaceholder")}
						value={memoryContent}
						onChange={(e) => setMemoryContent(e.target.value)}
					/>
				</div>
			</Flex>
		</div>
	)
}
