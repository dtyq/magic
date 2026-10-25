import { generateContactApi } from "./modules/contact"
import { defaultMagicClient as magicClient } from "@/infrastructure/network/http"
import chatWebSocketClient from "./clients/chatWebSocket"
import { generateUserApi } from "./modules/user"
import { generateCommonApi } from "./modules/common"
import { generateAuthApi } from "./modules/auth"
import { generateBotApi } from "./modules/bot"
import { generateFavoritesApi } from "./modules/favorites"
import { generateFileApi } from "./modules/file"
import { generateFlowApi } from "./modules/flow"
import { generateKnowledgeApi } from "./modules/knowledge/knowledge"
import { generateSearchApi } from "./modules/search"
import { generateChatApi } from "./modules/chat"
import { generateLongMemoryApi } from "./modules/generateLongMemoryApi"
import { generateMagicUserApi } from "./modules/magic-user"
import { generateGlobalApi } from "./modules/global"
import { generateScheduledTaskApi } from "./modules/scheduledTask"
import { generateSuperMagicApi } from "./modules/superMagic"
import { generateSkillsApi } from "./modules/skills"
import { generateHtmlDesignStylesApi } from "./modules/htmlDesignStyles"
import { generateCrewApi } from "./modules/crew"
import { generateOrgAiModelProviderApi } from "./modules/org-ai-model-provider"
import { generateRecycleBinApi } from "./modules/recycle-bin"
import { generateInitializationApi } from "./modules/initialization"
import { generateMagicClawApi } from "./modules/magicClaw"
import { generateFunctionPermissionApi } from "./modules/function-permission"
import { generateMagicFSApi } from "./modules/magicFS"
import { generateMagicBaseApi } from "./modules/magicBase"
import { generateSlidesTemplateUploadApi } from "./modules/slidesTemplateUpload"
import { generateNotificationApi } from "./modules/notifications"
import { buildAssetVisibility, generateAssetsApi } from "./modules/assets"

/** 重置服务 */
export const UserApi = generateUserApi(magicClient)
export const CommonApi = generateCommonApi(magicClient)

/** Magic 服务 */
export const AuthApi = generateAuthApi(magicClient)
export const ContactApi = generateContactApi(magicClient)
export const BotApi = generateBotApi(magicClient)
export const FavoritesApi = generateFavoritesApi(magicClient)
export const FileApi = generateFileApi(magicClient)
export const FlowApi = generateFlowApi(magicClient)
export const KnowledgeApi = generateKnowledgeApi(magicClient)
export const SearchApi = generateSearchApi(magicClient)
export const ChatApi = generateChatApi(magicClient, chatWebSocketClient)
export const LongMemoryApi = generateLongMemoryApi(magicClient)
export const MagicUserApi = generateMagicUserApi(magicClient)
export const GlobalApi = generateGlobalApi(magicClient)
export const ScheduledTaskApi = generateScheduledTaskApi(magicClient)
export const RecycleBinApi = generateRecycleBinApi(magicClient)
export const NotificationApi = generateNotificationApi(magicClient)

/** 超级麦吉 */
export const SuperMagicApi = generateSuperMagicApi(magicClient)
export const SlidesTemplateUploadApi = generateSlidesTemplateUploadApi(magicClient)
/** Skills */
export const SkillsApi = generateSkillsApi(magicClient)
/** HTML design styles */
export const HtmlDesignStylesApi = generateHtmlDesignStylesApi(magicClient)
/** Crew */
export const CrewApi = generateCrewApi(magicClient)

/** Org AI Model Provider (organization admin) */
export const OrgAiModelProviderApi = generateOrgAiModelProviderApi(magicClient)

/** Initialization (first-time setup) */
export const InitializationApi = generateInitializationApi(magicClient)

/** Magic Claw (Magi Claw) sandbox APIs */
export const MagicClawApi = generateMagicClawApi(magicClient)
/** Function permissions */
export const FunctionPermissionApi = generateFunctionPermissionApi(magicClient)
/** MagicFS 通用文件系统。 */
export const MagicFSApi = generateMagicFSApi(magicClient)
/** MagicBase */
export const MagicBaseApi = generateMagicBaseApi(magicClient)
export const AssetsApi = generateAssetsApi(magicClient)

export { MAGIC_CLAW_STATUS } from "./modules/magicClaw"
export {
	FUNCTION_PERMISSION_CODE,
	PLATFORM_SUPER_ADMIN_PERMISSION_KEY,
} from "./modules/function-permission"

export type {
	MagicClawItem,
	MagicClawListData,
	MagicClawStatus,
	MagicClawTemplateCode,
	CreateMagicClawBody,
	MagicClawSandboxBody,
	MagicClawSandboxStatusData,
	MagicClawSandboxVersionCheckData,
	UpdateMagicClawBody,
} from "./modules/magicClaw"

export type {
	FunctionPermissionCode,
	FunctionPermissionMap,
	PermissionGroupsResponse,
} from "./modules/function-permission"
export type {
	CreateMagicFSFileParams,
	ListMagicFSFilesParams,
	MagicFSFile,
	MagicFSFileResponse,
} from "./modules/magicFS"
export type { FileScope } from "./modules/fileScope"
export type {
	AssetAgreementStatusResponse,
	AssetBusinessType,
	AssetComplianceResponse,
	AssetComplianceStatus,
	AssetComplianceSourceParams,
	AssetFileSourceParams,
	AssetItem,
	AssetKind,
	AssetMediaType,
	AssetOwner,
	AssetOwnerItem,
	AssetQueryParams,
	AssetQueryResponse,
	AssetScope,
	AssetSource,
	AssetVisibilityType,
	AssetTag,
	AssetTagGroupItem,
	AssetTagItem,
	AssetTagListResponse,
	AssetTagTreeNode,
	AssetTagMatch,
	AssetTagMutationResponse,
	AssetTagNodeType,
	AssetVisibilityConfig,
	AssetVisibilityConfigResponse,
	AssetVisibilityMember,
	BatchDeleteAssetsParams,
	BatchDeleteAssetsResponse,
	BatchGetAssetsParams,
	CreateAssetParams,
	CreateAssetTagParams,
	DeleteAssetResponse,
	PrivateUploadTokenCredentials,
	PrivateUploadTokenData,
	PrivateUploadTokenParams,
	SaveAssetToLibraryParams,
	SaveAssetVisibility,
	StartAssetComplianceParams,
	TransferAssetOwnerParams,
	TransferAssetOwnerResponse,
	UpdateAssetTagParams,
	UpdateAssetParams,
} from "./modules/assets"
export type {
	MagicBaseColumn,
	MagicBaseQueryRowsRequest,
	MagicBaseQueryRowsResponse,
	MagicBaseRow,
	MagicBaseSortRule,
	MagicBaseTable,
} from "./modules/magicBase"
export { buildAssetVisibility }
