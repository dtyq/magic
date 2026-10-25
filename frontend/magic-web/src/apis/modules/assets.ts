import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"

export type AssetKind = "ASSET" | "GROUP"
export type AssetBusinessType = string
export type AssetMediaType = "IMAGE" | "VIDEO" | "AUDIO"
export type AssetComplianceStatus = "UNVERIFIED" | "PROCESSING" | "PASS" | "FAILED"
export type AssetScope = "PERSONAL" | "TEAM" | "ALL" | "PUBLIC"
export type AssetSource = "PERSONAL" | "TEAM" | "PUBLIC"
export type AssetVisibilityType = "PERSONAL" | "TEAM"
export type AssetTagNodeType = "group" | "tag"
export type AssetTagMatch = "any" | "all"

export interface PrivateUploadTokenParams {
	business_code: "ASSET"
	expires?: number
}

export interface PrivateUploadTokenCredentials {
	ExpiredTime: string
	CurrentTime: string
	AccessKeyId: string
	SecretAccessKey: string
	SessionToken: string
}

export interface PrivateUploadTokenData {
	platform: "tos" | string
	temporary_credential: {
		host: string
		region: string
		endpoint: string
		credentials: PrivateUploadTokenCredentials
		bucket: string
		dir: string
		expires: number
		callback: string
	}
	expires: number
	magic_service_host: string
}

export interface AssetAgreementStatusResponse {
	signed: boolean
}

export interface AssetOwner {
	id: string | null
	name: string
}

export interface AssetTag {
	id: string
	name: string
}

export interface AssetItem {
	asset_id: string
	asset_kind: AssetKind
	asset_business_type: string | null
	asset_media_type: AssetMediaType | null
	parent_id: string | null
	name: string
	description: string
	file_url: string | null
	/** Signed URL expiry when newer backends expose it; absent on legacy deployments. */
	expires_at?: string | null
	/** Optional server-generated preview URL; older backends may omit it. */
	thumbnail_url?: string | null
	/** 私有桶文件 Key；列表/详情返回后用于素材库弹窗发起合规（POST /assets + file_key）。 */
	file_key?: string | null
	project_id?: string | null
	project_file_path?: string | null
	compliance_status: AssetComplianceStatus
	compliance_failed_reason: string | null
	owner: AssetOwner
	owner_uid: string | null
	source: AssetSource
	/** Explicit visibility contract returned by the asset service. */
	visibility_type?: AssetVisibilityType
	tags: AssetTag[]
}

export interface AssetParamsBase {
	asset_kind?: "ASSET"
	asset_business_type?: AssetBusinessType
	parent_id?: string | null
	name?: string | null
	description?: string | null
	status?: 0 | 1
	tag_ids?: string[]
}

export type AssetFileSourceParams =
	| {
			file_key: string
			project_id?: string
			project_file_path?: string
	  }
	| {
			file_key?: never
			project_id: string
			project_file_path: string
	  }

export interface SaveAssetVisibility {
	visibility_type: AssetVisibilityType
	user_ids?: string[]
	department_ids?: string[]
}

/** Encode the two UI visibility states into the asset API contract. */
export function buildAssetVisibility(
	userIds?: string[],
	departmentIds?: string[],
): SaveAssetVisibility {
	const normalizedUserIds = userIds ?? []
	const normalizedDepartmentIds = departmentIds ?? []
	return {
		visibility_type:
			normalizedUserIds.length > 0 || normalizedDepartmentIds.length > 0
				? "TEAM"
				: "PERSONAL",
		user_ids: normalizedUserIds,
		department_ids: normalizedDepartmentIds,
	}
}

export interface UpdateAssetParams {
	name: string
	description: string
	visibility?: {
		visibility_type: AssetVisibilityType
		user_ids: string[]
		department_ids: string[]
	}
	tag_ids: string[]
}

export interface AssetVisibilityMember {
	id: string
	nickname?: string
	name?: string
}

export interface AssetVisibilityConfig {
	visibility_type?: 0 | 1 | 2
	users?: AssetVisibilityMember[]
	departments?: AssetVisibilityMember[]
}

export interface AssetVisibilityConfigResponse {
	resource_type: number
	resource_code: string
	visibility_config?: AssetVisibilityConfig
}

export type CreateAssetParams = AssetParamsBase &
	AssetFileSourceParams & {
		visibility?: SaveAssetVisibility
	}

export type AssetComplianceSourceParams =
	| {
			file_key: string
			project_id?: never
			project_file_path?: never
	  }
	| {
			file_key?: never
			project_id: string
			project_file_path: string
	  }

export type StartAssetComplianceParams = AssetParamsBase &
	AssetComplianceSourceParams & {
		visibility?: SaveAssetVisibility
	}

export type SaveAssetToLibraryParams = {
	name: string
	description?: string | null
	visibility?: SaveAssetVisibility
	tag_ids?: string[]
} & AssetFileSourceParams

export interface AssetQueryParams {
	scope?: AssetScope
	asset_kind?: AssetKind
	asset_business_type?: AssetBusinessType
	asset_media_type?: AssetMediaType
	parent_id?: string
	keyword?: string
	page?: number
	page_size?: number
	status?: 0 | 1
	compliance_status?: Extract<AssetComplianceStatus, "PASS">
	owner_uids?: string[]
	tag_ids?: string[]
	tag_match?: AssetTagMatch
}

export interface AssetQueryResponse {
	page: number
	page_size: number
	total: number
	list: AssetItem[]
}

export interface BatchGetAssetsParams {
	asset_ids: string[]
}

export interface BatchDeleteAssetsParams {
	asset_ids: string[]
}

export interface BatchDeleteAssetsResponse {
	deleted_num: number
	asset_ids: string[]
}

export interface AssetComplianceResponse {
	asset_id: string
	compliance_status: AssetComplianceStatus
	compliance_failed_reason: string | null
}

export interface BatchAssetComplianceResponse {
	items: AssetComplianceResponse[]
}

export interface AssetTagGroupItem {
	id: string
	parentId: string | null
	nodeType: "group"
	name: string
	ownerUid: string | null
	isOfficial: boolean
	tags: AssetTagItem[]
}

export interface AssetTagItem {
	id: string
	parentId: string | null
	nodeType: "tag"
	name: string
	ownerUid: string | null
	isOfficial: boolean
}

export type AssetTagTreeNode = AssetTagGroupItem | AssetTagItem

export type AssetTagListResponse = AssetTagTreeNode[]

export interface CreateAssetTagParams {
	name: string
	node_type?: AssetTagNodeType
	/** `null` means the tag has no group and is a custom tag. `"0"` is a top-level group. */
	parent_id?: string | null
}

export interface UpdateAssetTagParams extends CreateAssetTagParams {}

export interface AssetTagMutationResponse {
	id: string
	parentId?: string | null
	nodeType?: AssetTagNodeType
	name?: string
	ownerUid?: string | null
	isOfficial?: boolean
	deleted?: boolean
}

export interface AssetOwnerItem {
	id: string
	name: string
}

export interface TransferAssetOwnerParams {
	asset_ids: string[]
	owner_uid: string
}

export interface TransferAssetOwnerResponse {
	changed_num: number
	owner_uid: string
}

export interface DeleteAssetResponse {
	asset_id: string
	deleted: boolean
}

/**
 * 后端新接口不再返回 PASSED，但旧环境或缓存数据可能仍携带该值。
 * 统一在 API 边界归一，避免 Canvas 和 UI 保留第二套状态判断。
 */
export function normalizeAssetComplianceStatus(value: unknown): AssetComplianceStatus {
	if (value === "PROCESSING") return "PROCESSING"
	if (value === "PASS" || value === "PASSED") return "PASS"
	if (value === "FAILED") return "FAILED"
	return "UNVERIFIED"
}

export function normalizeAssetMediaType(value: unknown): AssetMediaType | null {
	return value === "IMAGE" || value === "VIDEO" || value === "AUDIO" ? value : null
}

export function normalizeAssetItem(value: AssetItem): AssetItem {
	return {
		...value,
		// Older list/detail deployments may omit optional-looking fields even
		// though the shared response type marks them as present. Normalize them at
		// the API boundary so Canvas and the picker never guess a media type or
		// crash while rendering tags/owner metadata.
		asset_media_type: normalizeAssetMediaType(value.asset_media_type),
		file_url: value.file_url ?? null,
		tags: Array.isArray(value.tags) ? value.tags : [],
		owner: value.owner ?? { id: null, name: "" },
		compliance_status: normalizeAssetComplianceStatus(value.compliance_status),
	}
}

/**
 * 资产库前台 API。
 *
 * ServiceHttpClient 会自动解包统一响应中的 data 字段，因此这里的返回类型
 * 对应接口文档中的业务数据，而不是重复声明 { code, message, data } 外壳。
 */
export const generateAssetsApi = (fetch: ServiceHttpClient) => ({
	/** 获取上传资产所需的 TOS 私有上传凭证。 */
	getPrivateUploadToken(params: PrivateUploadTokenParams) {
		return fetch.post<PrivateUploadTokenData>("/api/v1/file/private-upload-token", params)
	},

	/** 查询当前用户在当前组织下是否已签署素材协议。 */
	getAssetAgreementStatus() {
		return fetch.get<AssetAgreementStatusResponse>("/api/v1/asset-agreements")
	},

	/** 签署素材协议，接口幂等。 */
	signAssetAgreement() {
		return fetch.post<unknown[]>("/api/v1/asset-agreements")
	},

	/** @deprecated Use startAssetCompliance; kept for external compatibility. */
	createAsset(params: CreateAssetParams) {
		return fetch.post<AssetItem>("/api/v1/assets", params).then(normalizeAssetItem)
	},

	/** 发起素材合规检查；来源为已有 file_key 或工作区项目文件。 */
	startAssetCompliance(params: StartAssetComplianceParams) {
		return fetch.post<AssetItem>("/api/v1/assets", params).then(normalizeAssetItem)
	},

	/** 保存未经过第三方审核的本地资产。 */
	saveAssetToLibrary(params: SaveAssetToLibraryParams) {
		return fetch.post<AssetItem>("/api/v1/assets/library", params).then(normalizeAssetItem)
	},

	/** 分页查询个人、团队分享或官方资产。 */
	queryAssets(params: AssetQueryParams = {}) {
		return fetch
			.post<AssetQueryResponse>("/api/v1/assets/queries", params)
			.then((response) => ({
				...response,
				list: response.list.map(normalizeAssetItem),
			}))
	},

	/** 查询资产详情。 */
	getAsset(assetId: string) {
		return fetch.get<AssetItem>(`/api/v1/assets/${assetId}`).then(normalizeAssetItem)
	},

	/** 查询素材的用户/部门授权明细，用于编辑弹窗恢复原始可见范围。 */
	getAssetVisibilityConfig(assetId: string) {
		return fetch.get<AssetVisibilityConfigResponse>("/api/v1/resource-visibility/config", {
			params: {
				resource_type: 5,
				resource_code: assetId,
			},
		})
	},

	/** 编辑素材元数据；不包含文件字段，空 tag_ids 会清空标签关联。 */
	updateAsset(assetId: string, params: UpdateAssetParams) {
		return fetch.put<AssetItem>(`/api/v1/assets/${assetId}`, params).then(normalizeAssetItem)
	},

	/** 按资产 ID 批量获取最新详情和动态文件链接。 */
	batchGetAssets(params: BatchGetAssetsParams) {
		return fetch
			.post<AssetItem[]>("/api/v1/assets/batch-get", params)
			.then((assets) => assets.map(normalizeAssetItem))
	},

	/** 批量删除当前用户归属的个人资产。 */
	batchDeleteAssets(params: BatchDeleteAssetsParams) {
		return fetch.post<BatchDeleteAssetsResponse>("/api/v1/assets/batch-delete", params)
	},

	/** 查询单个资产的异步合规状态。 */
	getAssetCompliance(assetId: string) {
		return fetch
			.get<AssetComplianceResponse>(`/api/v1/assets/${assetId}/compliance`)
			.then((response) => ({
				...response,
				compliance_status: normalizeAssetComplianceStatus(response.compliance_status),
			}))
	},

	/** 批量查询素材的异步合规状态，供多个进行中素材共享一次轮询请求。 */
	batchGetAssetCompliance(params: BatchGetAssetsParams) {
		return fetch
			.post<BatchAssetComplianceResponse>("/api/v1/assets/batch-compliance", params)
			.then((response) =>
				response.items.map((item) => ({
					...item,
					compliance_status: normalizeAssetComplianceStatus(item.compliance_status),
				})),
			)
	},

	/** 查询官方和当前用户创建的标签树。 */
	getAssetTags() {
		return fetch.get<AssetTagListResponse>("/api/v1/assets/tags")
	},

	/** 创建用户标签组或标签。 */
	createAssetTag(params: CreateAssetTagParams) {
		return fetch.post<AssetTagMutationResponse>("/api/v1/assets/tags", params)
	},

	/** 修改用户标签组或标签。 */
	updateAssetTag(tagId: string, params: UpdateAssetTagParams) {
		return fetch.put<AssetTagMutationResponse>(`/api/v1/assets/tags/${tagId}`, params)
	},

	/** 删除用户标签组或标签。 */
	deleteAssetTag(tagId: string) {
		return fetch.delete<AssetTagMutationResponse>(`/api/v1/assets/tags/${tagId}`)
	},

	/** 查询当前用户可见的其他资产归属人。 */
	getAssetOwners() {
		return fetch.get<AssetOwnerItem[]>("/api/v1/assets/owners")
	},

	/** 批量转移资产归属人。 */
	transferAssetOwner(params: TransferAssetOwnerParams) {
		return fetch.post<TransferAssetOwnerResponse>("/api/v1/assets/transfer-owner", params)
	},

	/** 删除当前用户归属的个人资产。 */
	deleteAsset(assetId: string) {
		return fetch.delete<DeleteAssetResponse>(`/api/v1/assets/${assetId}`)
	},
})
