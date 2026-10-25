import { useState, useCallback, useEffect, useRef } from "react"
import { SuperMagicApi } from "@/apis"
import { createShareFileAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import { loadProjectAttachments } from "@/pages/superMagic/services"
import { loadShareFilesV2 } from "../services/shareFilesLoader"

interface UseNewTopicShareDataReturn {
	attachments: any
	loading: boolean
	error: Error | null
	isProjectShare: boolean
	getShareData: (params: { resource_id: string; password?: string }) => Promise<any>
	updateAttachments: (params: {
		projectId?: string
		resource_id?: string
		password?: string
		temporaryToken?: string
	}) => void
	setIsProjectShare: (value: boolean) => void
}

function isAbortError(error: unknown) {
	return (error as { name?: string } | null | undefined)?.name === "AbortError"
}

/**
 * Hook for handling new topic share data fetching
 * New format: /share/topic/{resourceId} (resourceId = topicId)
 * - Gets share data using resourceId
 * - Gets project_id from share data
 * - Gets attachments using project_id
 * - Gets the complete shared file tree through V2 cursor pagination
 */
export default function useNewTopicShareData(): UseNewTopicShareDataReturn {
	const [attachments, setAttachments] = useState<any>({})
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)
	const [isProjectShare, setIsProjectShare] = useState(false)
	const fetchPageCountRef = useRef(0)
	const attachmentsAbortControllerRef = useRef<AbortController | null>(null)

	useEffect(() => {
		return () => attachmentsAbortControllerRef.current?.abort()
	}, [])

	const getShareData = useCallback(
		({ resource_id, password }: { resource_id: string; password?: string }) => {
			return new Promise((resolve, reject) => {
				const allData: any = { list: [] }
				fetchPageCountRef.current = 0
				const pageSize = 500

				async function fetchPage(page = 1) {
					try {
						fetchPageCountRef.current += 1
						const res: any = await SuperMagicApi.getShareResource({
							resource_id,
							password,
							page,
						})
						// 话题分享不可能是项目分享，保持 isProjectShare 为 false
						// Merge data
						if (page === 1) {
							// Keep all the metadata from first response (including view_file_list)
							Object.assign(allData, res.data)
							// Also include view_file_list from extra if exists
							if (res.data?.extra?.view_file_list !== undefined) {
								allData.view_file_list = res.data.extra.view_file_list
							}
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
								// Include view_file_list from allData (set from extra in first page)
								view_file_list: allData.view_file_list,
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
		(params: {
			projectId?: string
			resource_id?: string
			password?: string
			temporaryToken?: string
		}) => {
			const { projectId, resource_id, password, temporaryToken } = params
			attachmentsAbortControllerRef.current?.abort()
			const abortController = new AbortController()
			attachmentsAbortControllerRef.current = abortController
			setLoading(true)
			setError(null)

			const commitAttachments = (nextAttachments: any) => {
				if (attachmentsAbortControllerRef.current !== abortController) return
				setAttachments(nextAttachments)
			}

			const handleFailure = (reason: unknown) => {
				if (
					isAbortError(reason) ||
					attachmentsAbortControllerRef.current !== abortController
				) {
					return
				}
				setError(reason instanceof Error ? reason : new Error(String(reason)))
			}

			const finishLoading = () => {
				if (attachmentsAbortControllerRef.current !== abortController) return
				setLoading(false)
			}

			// New resource shares use the share-code cursor protocol for every resource type.
			if (resource_id) {
				// Reuse TopicPage's first/middle/final batch commits so paginated loads do not
				// setState on every cursor page.
				let didCommitFinalSnapshot = false
				loadShareFilesV2({
					resourceId: resource_id,
					password,
					signal: abortController.signal,
					onBatchSnapshot: ({ tree, list, isFinal }) => {
						if (attachmentsAbortControllerRef.current !== abortController) return
						commitAttachments({ tree, list })
						if (isFinal) didCommitFinalSnapshot = true
					},
				})
					.then((result) => {
						if (didCommitFinalSnapshot) return
						commitAttachments(result)
					})
					.catch(handleFailure)
					.finally(finishLoading)
			} else if (projectId) {
				// 使用 projectId（旧格式或话题分享）
				loadProjectAttachments({
					projectId,
					signal: abortController.signal,
					access: temporaryToken
						? createShareFileAccess({ token: temporaryToken, projectId })
						: undefined,
				})
					.then(commitAttachments)
					.catch(handleFailure)
					.finally(finishLoading)
			} else {
				finishLoading()
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
		setIsProjectShare,
	}
}
