import { useState, useCallback, useRef } from "react"
import { SuperMagicApi } from "@/opensource/apis"
import { ResourceType } from "../../superMagic/components/Share/types"
import { AttachmentDataProcessor } from "../../superMagic/utils/attachmentDataProcessor"

interface UseLegacyFileShareDataReturn {
	attachments: any
	loading: boolean
	error: Error | null
	isProjectShare: boolean
	getShareData: (params: { resource_id: string; password?: string }) => Promise<any>
	updateAttachments: (params: {
		projectId?: string
		resource_id?: string
		password?: string
	}) => void
}

/**
 * Hook for handling legacy file share data fetching
 * Legacy format: /share/{topicId}/file/{fileId}
 * - Gets share data using topicId
 * - Gets project_id from share data
 * - Gets attachments using project_id
 */
export default function useLegacyFileShareData(): UseLegacyFileShareDataReturn {
	const [attachments, setAttachments] = useState<any>({})
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)
	const [isProjectShare, setIsProjectShare] = useState(false)
	const fetchPageCountRef = useRef(0)

	const getShareData = useCallback(
		({ resource_id, password }: { resource_id: string; password?: string }) => {
			return new Promise((resolve, reject) => {
				const allData: any = { list: [] }
				fetchPageCountRef.current = 0
				const pageSize = 500

				const fetchPage = async (page = 1) => {
					try {
						fetchPageCountRef.current += 1
						const res: any = await SuperMagicApi.getShareResource({
							resource_id,
							password,
							page,
						})
						// 设置 isProjectShare 状态：文件分享类型并且 share_project 为 true 才是项目分享
						if (page === 1 && res.share_project === true) {
							setIsProjectShare(true)
						} else if (page === 1) {
							setIsProjectShare(false)
						}
						// Merge data
						if (page === 1) {
							// Keep all the metadata from first response
							Object.assign(allData, res.data)
						}

						// Append items from this page
						if (res.data.list?.length) {
							allData.list = [...(allData.list || []), ...(res.data.list || [])]
						}

						// Check if we need to fetch more pages - calculate based on current page and total
						const total = res.data.total || 0
						const totalPages = Math.ceil(total / pageSize)

						if (page < totalPages) {
							// Fetch next page
							await fetchPage(page + 1)
						} else {
							// 在resolve之前对数组进行去重，使用message_id作为唯一标识，保持原有顺序
							if (allData.list && allData.list.length > 0) {
								const uniqueIds = new Set()
								allData.list = allData.list.filter((item: any) => {
									if (item.message_id && uniqueIds.has(item.message_id)) {
										return false
									}
									if (item.message_id) {
										uniqueIds.add(item.message_id)
									}
									return true
								})
							}
							resolve({
								...res,
								data: allData,
							})
						}
					} catch (error) {
						reject(error)
					}
				}

				// Start fetching from first page
				fetchPage()
			})
		},
		[],
	)

	const updateAttachments = useCallback(
		(params: { projectId?: string; resource_id?: string; password?: string }) => {
			const { projectId } = params

			// Legacy hooks 只支持 projectId
			if (projectId) {
				setLoading(true)
				setError(null)
				SuperMagicApi.getAttachmentsByProjectId({
					projectId,
					// @ts-ignore 使用window添加临时的token
					temporaryToken: window?.temporary_token || "",
				})
					.then((res: any) => {
						// 统一处理 metadata，包括 index.html 文件的特殊逻辑，内部自闭环处理验证和返回逻辑
						const processedData = AttachmentDataProcessor.processAttachmentData(res)
						setAttachments(processedData)
					})
					.catch((err) => {
						setError(err)
					})
					.finally(() => {
						setLoading(false)
					})
			}
		},
		[],
	)

	return {
		attachments,
		loading,
		error,
		isProjectShare,
		getShareData,
		updateAttachments,
	}
}
