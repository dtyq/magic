import { Modal, Input, Flex } from "antd"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { DocumentOperationType } from "../../../constant"
import { KnowledgeApi } from "@/opensource/apis"
import type { Knowledge } from "@/opensource/types/knowledge"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface UseDocumentOperationsProps {
	knowledgeBaseCode: string
	documentList: Knowledge.EmbedDocumentDetail[]
	selectedRowKeys: string[]
	setSelectedRowKeys: (keys: string[]) => void
	pageInfo: {
		page: number
		pageSize: number
	}
	searchText: string
	getKnowledgeDocumentList: (
		code: string,
		name: string,
		page: number,
		pageSize: number,
	) => Promise<void> | void
}

export const useDocumentOperations = ({
	knowledgeBaseCode,
	documentList,
	selectedRowKeys,
	setSelectedRowKeys,
	pageInfo,
	searchText,
	getKnowledgeDocumentList,
}: UseDocumentOperationsProps) => {
	const { t } = useTranslation("flow")

	// 处理单个文档操作
	const handleSingleDocOperation = useMemoizedFn(
		async (record: Knowledge.EmbedDocumentDetail, operationType: DocumentOperationType) => {
			// 根据操作类型获取标题和内容
			const getTitleAndContent = () => {
				switch (operationType) {
					case DocumentOperationType.ENABLE:
						return {
							title: t("knowledgeDatabase.enableDocument"),
							content: t("knowledgeDatabase.confirmEnableDocument", {
								name: record.name,
							}),
						}
					case DocumentOperationType.DISABLE:
						return {
							title: t("knowledgeDatabase.disableDocument"),
							content: t("knowledgeDatabase.confirmDisableDocument", {
								name: record.name,
							}),
						}
					case DocumentOperationType.DELETE:
						return {
							title: t("knowledgeDatabase.deleteDocument"),
							content: t("knowledgeDatabase.confirmDeleteDocument", {
								name: record.name,
							}),
						}
				}
			}

			const { title, content } = getTitleAndContent()

			Modal.confirm({
				title,
				content,
				onOk: async () => {
					try {
						let success = false

						// 根据操作类型执行不同的API调用
						if (operationType === DocumentOperationType.DELETE) {
							// TypeScript类型断言，确保编译通过
							await KnowledgeApi.deleteKnowledgeDocument({
								knowledge_code: knowledgeBaseCode,
								document_code: record.code,
							})
							success = true
						} else {
							// 启用或禁用操作
							// TypeScript类型断言，确保编译通过
							const data = await KnowledgeApi.updateKnowledgeDocument({
								knowledge_code: knowledgeBaseCode,
								document_code: record.code,
								name: record.name,
								enabled: operationType === DocumentOperationType.ENABLE,
							})
							success = !!data
						}

						// 刷新数据列表
						await getKnowledgeDocumentList(
							knowledgeBaseCode,
							searchText,
							pageInfo.page,
							pageInfo.pageSize,
						)

						// 显示成功消息
						if (success) {
							let successMessage = ""
							switch (operationType) {
								case DocumentOperationType.ENABLE:
									successMessage = t("knowledgeDatabase.fileEnableSuccess", {
										name: record.name,
									})
									break
								case DocumentOperationType.DISABLE:
									successMessage = t("knowledgeDatabase.fileDisableSuccess", {
										name: record.name,
									})
									break
								case DocumentOperationType.DELETE:
									successMessage = t("knowledgeDatabase.deleteDocumentSuccess", {
										name: record.name,
									})
									break
							}
							magicToast.success(successMessage)
						}
					} catch (error) {
						console.error("操作失败:", error)
						magicToast.error(t("common.operationFailed"))
					}
				},
			})
		},
	)

	// 批量操作文档
	const handleBatchOperation = useMemoizedFn(async (operationType: DocumentOperationType) => {
		if (!selectedRowKeys.length) {
			magicToast.warning(t("knowledgeDatabase.selectDocumentTip"))
			return
		}

		// 根据操作类型获取标题和内容
		const getTitleAndContent = () => {
			switch (operationType) {
				case DocumentOperationType.ENABLE:
					return {
						title: t("knowledgeDatabase.enableDocument"),
						content: t("knowledgeDatabase.confirmBatchEnable", {
							count: selectedRowKeys.length,
						}),
					}
				case DocumentOperationType.DISABLE:
					return {
						title: t("knowledgeDatabase.disableDocument"),
						content: t("knowledgeDatabase.confirmBatchDisable", {
							count: selectedRowKeys.length,
						}),
					}
				case DocumentOperationType.DELETE:
					return {
						title: t("knowledgeDatabase.deleteDocument"),
						content: t("knowledgeDatabase.confirmBatchDelete", {
							count: selectedRowKeys.length,
						}),
					}
			}
		}

		const { title, content } = getTitleAndContent()

		Modal.confirm({
			title,
			content,
			onOk: async () => {
				try {
					// 对所选行执行操作，并追踪结果
					const operationResults = await Promise.allSettled(
						selectedRowKeys.map(async (code) => {
							try {
								if (operationType === DocumentOperationType.DELETE) {
									await KnowledgeApi.deleteKnowledgeDocument({
										knowledge_code: knowledgeBaseCode,
										document_code: code,
									})
									return { success: true, code }
								} else {
									// 获取文档名称
									const record = documentList.find((item) => item.code === code)
									await KnowledgeApi.updateKnowledgeDocument({
										knowledge_code: knowledgeBaseCode,
										document_code: code,
										name: record?.name || "",
										enabled: operationType === DocumentOperationType.ENABLE,
									})
									return { success: true, code }
								}
							} catch (error) {
								return { success: false, code, error }
							}
						}),
					)

					// 更新选中的行
					setSelectedRowKeys([])

					// 刷新数据列表
					await getKnowledgeDocumentList(
						knowledgeBaseCode,
						searchText,
						pageInfo.page,
						pageInfo.pageSize,
					)

					// 统计成功和失败的操作
					const successCount = operationResults.filter(
						(result) => result.status === "fulfilled" && result.value.success,
					).length
					const failedCount = selectedRowKeys.length - successCount

					// 根据操作类型获取提示词
					let successMessage = ""
					switch (operationType) {
						case DocumentOperationType.ENABLE:
							successMessage = t("knowledgeDatabase.enableDocumentsSuccess", {
								count: successCount,
							})
							break
						case DocumentOperationType.DISABLE:
							successMessage = t("knowledgeDatabase.disableDocumentsSuccess", {
								count: successCount,
							})
							break
						case DocumentOperationType.DELETE:
							successMessage = t("knowledgeDatabase.deleteDocumentsSuccess", {
								count: successCount,
							})
							break
					}

					// 显示成功消息
					if (successCount > 0) {
						magicToast.success(successMessage)
					}

					// 如果有失败的操作，显示警告
					if (failedCount > 0) {
						magicToast.warning(
							t("knowledgeDatabase.batchOperationPartialFailed", {
								count: failedCount,
							}),
						)
					}
				} catch (error) {
					console.error("批量操作失败:", error)
					magicToast.error(t("common.operationFailed"))
				}
			},
		})
	})

	// 启用文档
	const handleEnableSingleFile = useMemoizedFn((record: Knowledge.EmbedDocumentDetail) => {
		handleSingleDocOperation(record, DocumentOperationType.ENABLE)
	})

	// 禁用文档
	const handleDisableSingleFile = useMemoizedFn((record: Knowledge.EmbedDocumentDetail) => {
		handleSingleDocOperation(record, DocumentOperationType.DISABLE)
	})

	// 删除单个文档
	const handleDeleteSingleFile = useMemoizedFn((record: Knowledge.EmbedDocumentDetail) => {
		handleSingleDocOperation(record, DocumentOperationType.DELETE)
	})

	// 批量删除文档
	const handleBatchDelete = useMemoizedFn(() => {
		handleBatchOperation(DocumentOperationType.DELETE)
	})

	// 批量启用文档
	const handleBatchEnable = useMemoizedFn(() => {
		handleBatchOperation(DocumentOperationType.ENABLE)
	})

	// 批量禁用文档
	const handleBatchDisable = useMemoizedFn(() => {
		handleBatchOperation(DocumentOperationType.DISABLE)
	})

	// 重命名文档
	const handleRenameFile = useMemoizedFn((record: Knowledge.EmbedDocumentDetail) => {
		let newFileName = record.name

		// 分离文件名和扩展名
		const lastDotIndex = record.name.lastIndexOf(".")
		const fileName = lastDotIndex > 0 ? record.name.substring(0, lastDotIndex) : record.name
		const fileExtension = lastDotIndex > 0 ? record.name.substring(lastDotIndex) : ""

		// 初始化为原始文件名（不包含扩展名）
		let inputFileName = fileName

		Modal.confirm({
			title: t("knowledgeDatabase.rename"),
			icon: null,
			centered: true,
			content: (
				<Flex
					vertical
					gap={10}
					style={{
						padding: "10px 0 20px",
					}}
				>
					<div>{t("knowledgeDatabase.documentName")}</div>
					<Input
						defaultValue={fileName}
						onChange={(e) => {
							inputFileName = e.target.value
						}}
						placeholder={t("knowledgeDatabase.inputDocumentNamePlaceholder")}
						addonAfter={fileExtension}
					/>
				</Flex>
			),
			onOk: async () => {
				try {
					if (!inputFileName || inputFileName === "") {
						magicToast.warning(t("knowledgeDatabase.inputDocumentNamePlaceholder"))
						return Promise.reject() // 阻止Modal关闭
					}

					// 合并文件名和扩展名
					newFileName = inputFileName + fileExtension

					if (newFileName === record.name) {
						return
					}

					// 调用API更新文档名称
					const data = await KnowledgeApi.updateKnowledgeDocument({
						knowledge_code: knowledgeBaseCode,
						document_code: record.code,
						name: newFileName,
						enabled: record.enabled,
					})

					if (data) {
						// 刷新数据列表
						await getKnowledgeDocumentList(
							knowledgeBaseCode,
							searchText,
							pageInfo.page,
							pageInfo.pageSize,
						)

						// 显示成功消息
						magicToast.success(
							t("knowledgeDatabase.renameDocumentSuccess", {
								name: data.name,
							}),
						)
					}
				} catch (error) {
					console.error("重命名失败:", error)
					magicToast.error(t("common.operationFailed"))
					return Promise.reject() // 发生错误时阻止Modal关闭
				}
			},
		})
	})

	return {
		handleSingleDocOperation,
		handleBatchOperation,
		handleEnableSingleFile,
		handleDisableSingleFile,
		handleDeleteSingleFile,
		handleBatchDelete,
		handleBatchEnable,
		handleBatchDisable,
		handleRenameFile,
	}
}
