import { memo, useCallback, useMemo, useRef, useState } from "react"
import { Input, Dropdown, Table, Modal, Empty } from "antd"
import { IconChevronDown, IconStarFilled } from "@tabler/icons-react"
import MagicButton from "@/components/base/MagicButton"
import MagicIcon from "@/components/base/MagicIcon"
import type { ColumnsType } from "antd/es/table"
import { useSize } from "ahooks"
import MagicSpin from "@/components/base/MagicSpin"
import { useStyles } from "./styles"
import { useStyles as useCommonStyles } from "../FileManager/styles"
import type { DataItem } from "./useData"
import useData from "./useData"
import magicToast from "@/components/base/MagicToaster/utils"
import { useTranslation } from "react-i18next"

export default memo(function MarkedFiles() {
	const { t } = useTranslation("super")
	const { styles } = useStyles()
	const { styles: commonStyles } = useCommonStyles()
	const containerRef = useRef<HTMLDivElement>(null)
	const containerSize = useSize(containerRef)
	const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
	const [searchKeywords, setSearchKeywords] = useState("")

	const { data, loading, setData } = useData({ searchKeywords })

	const handleCancel = useCallback(() => {
		setSelectedRowKeys([])
	}, [])

	const handleRemove = useCallback(() => {
		if (selectedRowKeys.length === 0) {
			magicToast.warning(t("sharedTopics.selectMarkedFirst"))
			return
		}
		Modal.confirm({
			title: t("sharedTopics.batchUnmarkTitle"),
			content: t("sharedTopics.batchUnmarkContent", { count: selectedRowKeys.length }),
			okText: t("sharedTopics.confirm"),
			cancelText: t("sharedTopics.cancel"),
			onOk: async () => {
				try {
					setData((prev) => prev.filter((file) => !selectedRowKeys.includes(file.id)))
					setSelectedRowKeys([])
					magicToast.success(t("sharedTopics.batchUnmarkSuccess"))
				} catch (error) {
					magicToast.error(t("sharedTopics.unmarkFailed"))
					console.error("Failed to batch remove stars:", error)
				}
			},
		})
	}, [selectedRowKeys, setData, t])

	const handleRemoveItem = useCallback((id: string) => {}, [])

	const handleTopicClick = useCallback((topicId: string) => {
		//
	}, [])

	const dropdownItems = useMemo(() => {
		return [
			{
				key: "1",
				label: t("sharedTopics.unselect"),
				onClick: handleCancel,
			},
		]
	}, [handleCancel, t])

	const columns: ColumnsType<DataItem> = useMemo(() => {
		return [
			{
				title: t("markedFiles.fileName"),
				dataIndex: "name",
			},
			{
				title: t("markedFiles.relatedTopic"),
				dataIndex: "topicName",
				width: "15%",
				render: (value, record) => {
					return (
						<MagicButton
							className={styles.topicButton}
							type="link"
							onClick={() => {
								handleTopicClick(record.id)
							}}
						>
							{value}
						</MagicButton>
					)
				},
			},
			{
				title: t("markedFiles.markedTime"),
				dataIndex: "uploadTime",
				width: "25%",
			},
			{
				title: t("markedFiles.action"),
				align: "center",
				width: 80,
				render: (_, record) => (
					<MagicButton
						type="text"
						className={styles.starIconButton}
						icon={<IconStarFilled size={16} className={styles.starIcon} />}
						onClick={() => handleRemoveItem(record.id)}
					/>
				),
			},
		]
	}, [
		styles.topicButton,
		styles.starIconButton,
		styles.starIcon,
		handleTopicClick,
		handleRemoveItem,
		t,
	])

	const content = data.length ? (
		<Table
			rowKey="id"
			columns={columns}
			className={styles.table}
			dataSource={data}
			loading={loading}
			rowSelection={{
				selectedRowKeys,
				onChange: (keys) => {
					setSelectedRowKeys(keys)
				},
			}}
			pagination={{
				pageSize: 20,
				showSizeChanger: false,
				className: styles.pagination,
			}}
			scroll={{ x: "100%", y: (containerSize?.height ?? 0) - 112 }}
		/>
	) : (
		<div className={commonStyles.emptyWrapper}>
			<Empty
				description={t("sharedTopics.emptyMarked")}
				image={Empty.PRESENTED_IMAGE_SIMPLE}
			/>
		</div>
	)

	return (
		<div className={commonStyles.pageContainer}>
			<div className={commonStyles.title}>{t("markedFiles.title")}</div>
			<div className={commonStyles.description}>{t("markedFiles.subtitle")}</div>
			<div className={commonStyles.formHeader}>
				<Input
					placeholder={t("markedFiles.searchPlaceholder")}
					className={commonStyles.searchInput}
					value={searchKeywords}
					onChange={(event) => {
						setSearchKeywords(event.target.value)
					}}
				/>
				<Dropdown menu={{ items: dropdownItems }} disabled={selectedRowKeys.length === 0}>
					<MagicButton className={styles.batchOperationButton} onClick={handleRemove}>
						<span>{t("sharedTopics.batchAction")}</span>
						<MagicIcon component={IconChevronDown} size={20} stroke={2} />
					</MagicButton>
				</Dropdown>
			</div>
			<div ref={containerRef} className={commonStyles.pageContent}>
				{loading || !containerSize ? (
					<div className={commonStyles.loadingWrapper}>
						<MagicSpin />
					</div>
				) : (
					content
				)}
			</div>
		</div>
	)
})
