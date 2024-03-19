import { memo, useCallback, useMemo, useRef, useState } from "react"
import { Input, Dropdown, Table, Modal, Empty, Button, Space } from "antd"
import { IconChevronDown } from "@tabler/icons-react"
import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import type { ColumnsType } from "antd/es/table"
import { useSize } from "ahooks"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { useStyles } from "../MarkedFiles/styles"
import { useStyles as useCommonStyles } from "../FileManager/styles"
import type { DataItem } from "./useData"
import useData from "./useData"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

export default memo(function SharedTopics() {
	const { styles } = useStyles()
	const { styles: commonStyles } = useCommonStyles()
	const containerRef = useRef<HTMLDivElement>(null)
	const containerSize = useSize(containerRef)
	const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
	const [searchKeywords, setSearchKeywords] = useState("")

	const { data, loading, setData } = useData({ searchKeywords })

	const handleCancel = useCallback(() => {
		setSelectedRowKeys([])
		// Modal.confirm({
		// 	title: "取消选中",
		// 	content: `确定要取消选中的 ${selectedRowKeys.length} 个文件的标记吗？`,
		// 	okText: "确定",
		// 	cancelText: "取消",
		// 	onOk: async () => {
		// 		try {
		// 			setSelectedRowKeys([])
		// 			magicToast.success("已取消选中")
		// 		} catch (error) {
		// 			magicToast.error("取消失败")
		// 			console.error("Failed to batch remove stars:", error)
		// 		}
		// 	},
		// })
	}, [])

	const handleRemove = useCallback(() => {
		if (selectedRowKeys.length === 0) {
			magicToast.warning("请先选择标记文件")
			return
		}
		Modal.confirm({
			title: "批量取消标记",
			content: `确定要取消选中的 ${selectedRowKeys.length} 个文件的标记吗？`,
			okText: "确定",
			cancelText: "取消",
			onOk: async () => {
				try {
					setData((prev) => prev.filter((file) => !selectedRowKeys.includes(file.id)))
					setSelectedRowKeys([])
					magicToast.success("已批量取消标记")
				} catch (error) {
					magicToast.error("取消失败")
					console.error("Failed to batch remove stars:", error)
				}
			},
		})
	}, [selectedRowKeys, setData])

	const handleRemoveItem = useCallback((id: string) => {}, [])

	const dropdownItems = useMemo(() => {
		return [
			{
				key: "1",
				label: "取消选中",
				onClick: handleCancel,
			},
		]
	}, [handleCancel])

	const columns: ColumnsType<DataItem> = useMemo(() => {
		return [
			{
				title: "话题名称",
				dataIndex: "name",
			},
			{
				title: "分享方式",
			},
			{
				title: "工作区",
			},
			{
				title: "标记时间",
				dataIndex: "uploadTime",
				width: "25%",
			},
			{
				title: "操作",
				align: "center",
				width: 160,
				render: (_, record) => (
					<Space size={10}>
						<Button type="link" className={styles.operationButton}>
							设置权限
						</Button>
						<Button type="link" className={styles.operationButton}>
							取消分享
						</Button>
					</Space>
				),
			},
		]
	}, [styles.operationButton])

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
			<Empty description="暂无标记的文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
		</div>
	)

	return (
		<div className={commonStyles.pageContainer}>
			<div className={commonStyles.title}>分享的话题</div>
			<div className={commonStyles.description}>管理对外分享的话题</div>
			<div className={commonStyles.formHeader}>
				<Input
					placeholder="搜索话题"
					className={commonStyles.searchInput}
					value={searchKeywords}
					onChange={(event) => {
						setSearchKeywords(event.target.value)
					}}
				/>
				<Dropdown menu={{ items: dropdownItems }} disabled={selectedRowKeys.length === 0}>
					<MagicButton className={styles.batchOperationButton} onClick={handleRemove}>
						<span>批量操作</span>
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
