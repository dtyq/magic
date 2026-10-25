import {
	AssetsApi,
	type AssetTagMutationResponse,
	type AssetTagTreeNode,
	type CreateAssetTagParams,
	type UpdateAssetTagParams,
} from "@/apis"
import { useCallback, useEffect, useState } from "react"

export interface UseAssetTagsResult {
	tagGroups: AssetTagTreeNode[]
	loading: boolean
	error: unknown | null
	refresh: () => Promise<AssetTagTreeNode[]>
	createTag: (params: CreateAssetTagParams) => Promise<AssetTagMutationResponse>
	updateTag: (tagId: string, params: UpdateAssetTagParams) => Promise<AssetTagMutationResponse>
	deleteTag: (tagId: string) => Promise<AssetTagMutationResponse>
}

/**
 * Owns the tag tree request and mutations used by Canvas asset forms.
 * Keeping API state here lets the selector stay focused on keyboard and
 * selection behavior while every mutation refreshes the authoritative tree.
 */
export function useAssetTags(enabled: boolean): UseAssetTagsResult {
	const [tagGroups, setTagGroups] = useState<AssetTagTreeNode[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<unknown | null>(null)

	const refresh = useCallback(async () => {
		const groups = await AssetsApi.getAssetTags()
		setTagGroups(groups)
		setError(null)
		return groups
	}, [])

	useEffect(() => {
		if (!enabled) return

		let cancelled = false
		setLoading(true)
		setError(null)
		void AssetsApi.getAssetTags()
			.then((groups) => {
				if (!cancelled) setTagGroups(groups)
			})
			.catch((requestError) => {
				if (!cancelled) {
					setTagGroups([])
					setError(requestError)
				}
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})

		return () => {
			cancelled = true
		}
	}, [enabled])

	const mutate = useCallback(
		async <T>(request: () => Promise<T>): Promise<T> => {
			const response = await request()
			await refresh()
			return response
		},
		[refresh],
	)

	const createTag = useCallback(
		(params: CreateAssetTagParams) => mutate(() => AssetsApi.createAssetTag(params)),
		[mutate],
	)

	const updateTag = useCallback(
		(tagId: string, params: UpdateAssetTagParams) =>
			mutate(() => AssetsApi.updateAssetTag(tagId, params)),
		[mutate],
	)

	const deleteTag = useCallback(
		(tagId: string) => mutate(() => AssetsApi.deleteAssetTag(tagId)),
		[mutate],
	)

	return { tagGroups, loading, error, refresh, createTag, updateTag, deleteTag }
}
