import { useTranslation } from "react-i18next"
import { useState, useEffect, useRef } from "react"
import { Flex, Input, Button, Tag, Dropdown, Table } from "antd"
import { useMemoizedFn, useDebounceFn } from "ahooks"
import { IconChevronDown, IconDots, IconPlus } from "@tabler/icons-react"
import { useUpload } from "@/opensource/hooks/useUploadFiles"
import { genFileData } from "@/opensource/pages/vectorKnowledge/utils"
import { KnowledgeApi } from "@/opensource/apis"
import { Knowledge } from "@/opensource/types/knowledge"
import {
	documentSyncStatusMap,
	getExternalFileIconByType,
	SegmentationMode,
	DataSourceType,
} from "@/opensource/pages/vectorKnowledge/constant"
import { useDocumentOperations } from "../../hooks/useDocumentOperations"
import { useVectorKnowledgeDocumentStyles } from "./styles"
import DocumentUpload from "@/opensource/pages/vectorKnowledge/components/Upload/DocumentUpload"
import {
	hasEditRight,
	hasAdminRight,
} from "@/opensource/pages/flow/components/AuthControlButton/types"
import type { OperationTypes } from "@/opensource/pages/flow/components/AuthControlButton/types"
import IconActionButton from "@/opensource/enhance/tabler/icons-react/icons/IconActionButton"
import { FragmentConfig } from "@/opensource/pages/vectorKnowledge/types"
import { history } from "@/opensource/routes/history"
import { RouteName } from "@/opensource/routes/constants"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface Props {
	className: string
	knowledgeBaseCode: string
	sourceType: DataSourceType
	userOperation: OperationTypes
}

export default function Document({
	className,
	knowledgeBaseCode,
	sourceType,
	userOperation,
}: Props) {
	const { styles } = useVectorKnowledgeDocumentStyles()
	const { t } = useTranslation("flow")

	const rightContainerRef = useRef<HTMLDivElement>(null)
	const headerRef = useRef<HTMLDivElement>(null)

	const [documentList, setDocumentList] = useState<Knowledge.EmbedDocumentDetail[]>([])
	const [searchText, setSearchText] = useState("")
	const [tableHeight, setTableHeight] = useState<number | string>("100%")
	const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
	const [loading, setLoading] = useState(false)

	const [pageInfo, setPageInfo] = useState<{
		page: number
		pageSize: number
		total: number
	}>({
		page: 1,
		pageSize: 10,
		total: 0,
	})

	// 搜索处理 - 使用防抖
	const handleSearch = useMemoizedFn((value: string) => {
		setSearchText(value)
	})

	const { uploadAndGetFileUrl } = useUpload({
		storageType: "private",
	})

	/** 上传文件 */
	const handleFileUpload = useMemoizedFn(async (file: File) => {
		try {
			// 上传文件
			const newFile = genFileData(file)
			// 已通过 beforeFileUpload 预校验，故传入 () => true 跳过方法校验
			const { fullfilled } = await uploadAndGetFileUrl([newFile], () => true)
			// 更新上传的文件列表状态
			if (fullfilled && fullfilled.length) {
				const { path } = fullfilled[0].value
				const res = await KnowledgeApi.addKnowledgeDocument({
					knowledge_code: knowledgeBaseCode,
					enabled: true,
					document_file: {
						name: file.name,
						key: path,
					},
				})
				if (res) {
					magicToast.success(
						t("knowledgeDatabase.uploadDocumentSuccess", { name: file.name }),
					)
					debouncedGetDocumentList(
						knowledgeBaseCode,
						searchText,
						pageInfo.page,
						pageInfo.pageSize,
					)
				}
			}
		} catch (error) {
			console.error("上传文件失败:", error)
			magicToast.error(t("knowledgeDatabase.uploadFailed"))
		}
	})

	/**
	 * 获取知识库文档列表
	 */
	const getKnowledgeDocumentList = useMemoizedFn(
		async (
			code: string,
			name: string,
			page: number,
			pageSize: number,
			showLoading: boolean = true,
		) => {
			try {
				if (showLoading) {
					setLoading(true)
				}
				// 使用类型断言处理API调用
				const res = await (KnowledgeApi as any).getKnowledgeDocumentList({
					code,
					name: name || undefined,
					page,
					pageSize,
				})
				if (res) {
					// 只更新documentList中已有的文档
					if (documentList.length > 0 && res.page !== pageInfo.page) {
						// 创建文档编码映射，用于快速查找
						const documentListMap = new Map(
							documentList.map((item) => [item.code, item]),
						)

						// 使用映射更新文档
						const updatedDocumentList = [...documentList]
						let hasUpdates = false

						res.list.forEach((newItem: Knowledge.EmbedDocumentDetail) => {
							if (documentListMap.has(newItem.code)) {
								// 找到当前文档在数组中的索引
								const index = updatedDocumentList.findIndex(
									(item) => item.code === newItem.code,
								)
								if (index !== -1) {
									// 更新文档
									updatedDocumentList[index] = newItem
									hasUpdates = true
								}
							}
						})

						// 只有在有更新时才设置状态
						if (hasUpdates) {
							setDocumentList(updatedDocumentList)
						}
					} else {
						// 初始化时直接设置数据
						setDocumentList(res.list)
					}

					setPageInfo((prev) => ({
						...prev,
						total: res.total,
					}))
				}
			} catch (error) {
				console.error("获取知识库文档列表失败:", error)
			} finally {
				setLoading(false)
			}
		},
	)

	// 使用 ahooks 的 useDebounceFn 替代自定义防抖
	const { run: debouncedGetDocumentList } = useDebounceFn(
		(
			code: string,
			name: string,
			page: number,
			pageSize: number,
			showLoading: boolean = true,
		) => {
			return getKnowledgeDocumentList(code, name, page, pageSize, showLoading)
		},
		{ wait: 300, leading: true, trailing: false },
	)

	// 使用抽离出来的文档操作hook
	const {
		// handleEnableSingleFile,
		// handleDisableSingleFile,
		handleDeleteSingleFile,
		handleBatchDelete,
		handleBatchEnable,
		handleBatchDisable,
		handleRenameFile,
	} = useDocumentOperations({
		knowledgeBaseCode,
		documentList,
		selectedRowKeys,
		setSelectedRowKeys,
		pageInfo,
		searchText,
		getKnowledgeDocumentList: debouncedGetDocumentList, // 使用防抖版本的方法
	})

	// 获取文档状态标签
	const getStatusTag = (syncStatus: number, record: Knowledge.EmbedDocumentDetail) => {
		switch (syncStatus) {
			case documentSyncStatusMap.Pending:
				return (
					<Tag className={styles.statusTag} bordered={false} color="default">
						{t("knowledgeDatabase.syncStatus.pending")}
					</Tag>
				)
			case documentSyncStatusMap.Processing:
				return (
					<Tag className={styles.statusTag} bordered={false} color="processing">
						{t("knowledgeDatabase.syncStatus.processing")}
					</Tag>
				)
			case documentSyncStatusMap.Success:
				return (
					<>
						{record.enabled ? (
							<Tag className={styles.statusTag} bordered={false} color="success">
								{t("knowledgeDatabase.syncStatus.available")}
							</Tag>
						) : (
							<Tag className={styles.statusTag} bordered={false} color="warning">
								{t("knowledgeDatabase.syncStatus.disabled")}
							</Tag>
						)}
					</>
				)
			case documentSyncStatusMap.Failed:
				return (
					<Tag className={styles.statusTag} bordered={false} color="error">
						{t("knowledgeDatabase.syncStatus.failed")}
					</Tag>
				)
		}
	}

	/** 跳转文档配置页面 */
	const handleFileConfig = useMemoizedFn((record: Knowledge.EmbedDocumentDetail) => {
		history.push({
			name: RouteName.VectorKnowledgeCreate,
			query: {
				knowledgeBaseCode,
				documentCode: record.code,
			},
		})
	})

	/**
	 * 分页改变
	 */
	const handlePageChange = useMemoizedFn((page: number, pageSize: number) => {
		setPageInfo((prev) => ({
			...prev,
			page,
			pageSize,
		}))
	})

	/** 添加企业文档 */
	// const [addEnterpriseDocumentModal, setAddEnterpriseDocumentModal] = useState(false)
	// const [newEnterpriseDocuments, setNewEnterpriseDocuments] = useState<
	// 	Knowledge.TeamshareFileCascadeItem[]
	// >([])
	// const handleAddEnterpriseDocument = useMemoizedFn(() => {
	// 	Promise.all(
	// 		newEnterpriseDocuments.map(async (item) => {
	// 			await KnowledgeApi.addKnowledgeDocument({
	// 				knowledge_code: knowledgeBaseCode,
	// 				enabled: true,
	// 				document_file: {
	// 					name: item.name,
	// 					type: Knowledge.CreateKnowledgeFileType.THIRD_PLATFORM_FILE,
	// 					third_file_type: Knowledge.FilePlatformType.TEAMSHARE,
	// 					third_file_id: item.file_id,
	// 				},
	// 			})
	// 		}),
	// 	)
	// 		.then(() => {
	// 			magicToast.success(t("knowledgeDatabase.uploadSuccess"))
	// 		})
	// 		.finally(() => {
	// 			setAddEnterpriseDocumentModal(false)
	// 			setNewEnterpriseDocuments([])
	// 			debouncedGetDocumentList(
	// 				knowledgeBaseCode,
	// 				searchText,
	// 				pageInfo.page,
	// 				pageInfo.pageSize,
	// 			)
	// 		})
	// })
	// const handleCancelAddEnterpriseDocument = useMemoizedFn(() => {
	// 	setAddEnterpriseDocumentModal(false)
	// 	setNewEnterpriseDocuments([])
	// })

	/** 点击文档跳转对应地址 */
	const handleFileClick = useMemoizedFn((record: Knowledge.EmbedDocumentDetail) => {
		const fileType = record.document_file?.third_file_type
		const fileId = record.document_file?.third_file_id
		if (fileType && fileId) {
			switch (Number(fileType)) {
				case Knowledge.TeamshareFileCascadeItemFileType.MULTI_TABLE:
					history.push({ name: RouteName.BiTable, params: { tableId: fileId } })
					break
				case Knowledge.TeamshareFileCascadeItemFileType.CLOUD_DOCUMENT:
				case Knowledge.TeamshareFileCascadeItemFileType.OLD_CLOUD_DOCUMENT:
					history.push({ name: RouteName.Docx, params: { fileId } })
					break
				case Knowledge.TeamshareFileCascadeItemFileType.WHITE_BOARD:
					history.push({ name: RouteName.Whiteboard, params: { fileId } })
					break
				case Knowledge.TeamshareFileCascadeItemFileType.WORD:
				case Knowledge.TeamshareFileCascadeItemFileType.EXCEL:
				case Knowledge.TeamshareFileCascadeItemFileType.PPT:
				case Knowledge.TeamshareFileCascadeItemFileType.PDF:
					history.push({ name: RouteName.OfficeFile, params: { id: fileId } })
					break
				case Knowledge.TeamshareFileCascadeItemFileType.JSON:
					history.push({ name: RouteName.File, params: { fileId } })
					break
				default:
					magicToast.warning(t("knowledgeDatabase.noSupportJump"))
					break
			}
		}
	})

	// 计算表格高度
	useEffect(() => {
		const calculateTableHeight = () => {
			if (rightContainerRef.current && headerRef.current) {
				const containerHeight = rightContainerRef.current.clientHeight
				const headerHeight = headerRef.current.clientHeight
				const tableHeaderHeight = 45 // 表格头部高度，根据实际调整
				const paginationHeight = 64 // 分页器高度，根据实际调整
				const padding = 40 // 根据实际内边距调整
				setTableHeight(
					containerHeight - headerHeight - tableHeaderHeight - paginationHeight - padding,
				)
			}
		}

		calculateTableHeight()
		window.addEventListener("resize", calculateTableHeight)

		return () => {
			window.removeEventListener("resize", calculateTableHeight)
		}
	}, [])

	// 获取知识库文档列表
	useEffect(() => {
		if (knowledgeBaseCode) {
			debouncedGetDocumentList(
				knowledgeBaseCode,
				searchText,
				pageInfo.page,
				pageInfo.pageSize,
			)
		}
	}, [knowledgeBaseCode, searchText, pageInfo.page, pageInfo.pageSize])

	// 定时刷新文档列表
	const timeoutRef = useRef<NodeJS.Timeout | null>(null)

	useEffect(() => {
		if (
			documentList.length &&
			documentList.some((item) =>
				[documentSyncStatusMap.Pending, documentSyncStatusMap.Processing].includes(
					item.sync_status,
				),
			)
		) {
			// 清除之前的timeout
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}

			// 设置新的timeout并保存引用
			timeoutRef.current = setTimeout(() => {
				// 轮询请求不显示loading
				debouncedGetDocumentList(
					knowledgeBaseCode,
					searchText,
					pageInfo.page,
					pageInfo.pageSize,
					false,
				)
			}, 5000)
		}

		// 组件卸载时清除timeout
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}
	}, [documentList])

	// 表格列定义
	const columns = [
		{
			title: t("knowledgeDatabase.documentTitle"),
			dataIndex: "name",
			key: "name",
			width: 300,
			render: (name: string, record: Knowledge.EmbedDocumentDetail) => (
				<Flex
					align="center"
					style={{ cursor: "pointer", lineHeight: 1.4 }}
					onClick={() => handleFileClick(record)}
				>
					<span className={styles.fileTypeIcon}>
						{getExternalFileIconByType(record.doc_type)}
					</span>
					{name}
				</Flex>
			),
		},
		{
			title: t("knowledgeDatabase.segmentMode"),
			dataIndex: "fragment_config",
			key: "fragment_config",
			width: 100,
			render: (_value: FragmentConfig, record: Knowledge.EmbedDocumentDetail) => {
				const mode = record.fragment_config?.mode
				switch (mode) {
					case SegmentationMode.General:
						return (
							<div className={styles.segmentMode}>
								{t("knowledgeDatabase.segmentationMode.general")}
							</div>
						)
					case SegmentationMode.ParentChild:
						return (
							<div className={styles.segmentMode}>
								{t("knowledgeDatabase.segmentationMode.parentChild")}
							</div>
						)
					default:
						return (
							<div className={styles.segmentMode}>
								{t("knowledgeDatabase.segmentationMode.unknown")}
							</div>
						)
				}
			},
		},
		{
			title: t("knowledgeDatabase.wordCount"),
			dataIndex: "word_count",
			key: "word_count",
			width: 100,
		},
		{
			title: t("knowledgeDatabase.createTime"),
			dataIndex: "created_at",
			key: "created_at",
			width: 200,
		},
		{
			title: t("knowledgeDatabase.status"),
			dataIndex: "sync_status",
			key: "sync_status",
			width: 120,
			render: getStatusTag,
		},
		...(hasEditRight(userOperation)
			? [
					{
						title: t("knowledgeDatabase.operation"),
						key: "operation",
						width: 100,
						render: (_: any, record: Knowledge.EmbedDocumentDetail) => (
							<div className={styles.operation}>
								<div
									className={styles.actionButton}
									onClick={() => handleFileConfig(record)}
								>
									<IconActionButton size={24} />
								</div>
								<Dropdown
									placement="bottomRight"
									menu={{
										items: [
											{
												label: <div>{t("knowledgeDatabase.rename")}</div>,
												key: "rename",
												onClick: () => handleRenameFile(record),
											},
											// {
											// 	label: <div>{t("common.enable")}</div>,
											// 	key: "enable",
											// 	onClick: () => handleEnableSingleFile(record),
											// },
											// {
											// 	label: <div>{t("common.disabled")}</div>,
											// 	key: "disabled",
											// 	onClick: () => handleDisableSingleFile(record),
											// },
											...(hasAdminRight(userOperation) &&
											sourceType !== DataSourceType.Enterprise
												? [
														{
															label: (
																<div className={styles.deleteText}>
																	{t("knowledgeDatabase.delete")}
																</div>
															),
															key: "delete",
															onClick: () =>
																handleDeleteSingleFile(record),
														},
													]
												: []),
										],
									}}
								>
									<Flex
										align="center"
										justify="center"
										className={styles.operationButton}
									>
										<IconDots size={20} />
									</Flex>
								</Dropdown>
							</div>
						),
					},
				]
			: []),
	]

	return (
		<Flex vertical className={className} ref={rightContainerRef}>
			<div ref={headerRef}>
				<div className={styles.title}>{t("knowledgeDatabase.documentTitle")}</div>
				<div className={styles.subTitle}>{t("knowledgeDatabase.documentDesc")}</div>

				<Flex align="center" justify="space-between">
					<Input
						className={styles.searchBar}
						placeholder={t("knowledgeDatabase.search")}
						onChange={(e) => handleSearch(e.target.value)}
						allowClear
					/>
					{hasEditRight(userOperation) && sourceType !== DataSourceType.Enterprise && (
						<Flex align="stretch" gap={10}>
							<Dropdown
								menu={{
									items: [
										...(hasEditRight(userOperation)
											? [
													{
														label: <div>{t("common.enable")}</div>,
														key: "enable",
														onClick: () => handleBatchEnable(),
													},
													{
														label: <div>{t("common.disabled")}</div>,
														key: "disable",
														onClick: () => handleBatchDisable(),
													},
												]
											: []),
										...(hasAdminRight(userOperation)
											? [
													{
														label: (
															<div className={styles.deleteText}>
																{t("knowledgeDatabase.delete")}
															</div>
														),
														key: "delete",
														onClick: () => handleBatchDelete(),
													},
												]
											: []),
									],
								}}
							>
								<Flex align="center" gap={4} className={styles.batchOperation}>
									<div>{t("knowledgeDatabase.batchOperation")}</div>
									<IconChevronDown size={16} />
								</Flex>
							</Dropdown>
							{sourceType === DataSourceType.Local && (
								<DocumentUpload handleFileUpload={handleFileUpload} dragger={false}>
									<Button type="primary" icon={<IconPlus size={16} />}>
										{t("knowledgeDatabase.addDocument")}
									</Button>
								</DocumentUpload>
							)}
							{/* {sourceType === DataSourceType.Enterprise && (
								<Button
									type="primary"
									icon={<IconPlus size={16} />}
									onClick={() => setAddEnterpriseDocumentModal(true)}
								>
									{t("knowledgeDatabase.addDocument")}
								</Button>
							)} */}
						</Flex>
					)}
				</Flex>
			</div>

			<div className={styles.tableContainer}>
				<Table
					rowKey="code"
					loading={loading}
					rowSelection={
						hasEditRight(userOperation)
							? {
									selectedRowKeys,
									onChange: (codes) => setSelectedRowKeys(codes as string[]),
								}
							: undefined
					}
					columns={columns}
					dataSource={documentList}
					scroll={{ scrollToFirstRowOnChange: true, y: tableHeight }}
					pagination={{
						position: ["bottomLeft"],
						total: pageInfo.total,
						pageSize: pageInfo.pageSize,
						showSizeChanger: true,
						showQuickJumper: false,
						pageSizeOptions: ["10", "20", "50"],
						onChange: handlePageChange,
					}}
				/>
			</div>

			{/* <Modal
				width={800}
				title={t("knowledgeDatabase.bindEnterpriseKnowledgeLabel")}
				open={addEnterpriseDocumentModal}
				onCancel={handleCancelAddEnterpriseDocument}
				onOk={handleAddEnterpriseDocument}
			>
				<EnterpriseKnowledge
					showHeader={false}
					selectedFiles={newEnterpriseDocuments}
					setSelectedFiles={setNewEnterpriseDocuments}
				/>
			</Modal> */}
		</Flex>
	)
}
