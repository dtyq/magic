import { generateContactApi } from "./modules/contact"
import magicClient from "./clients/magic"
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
import { generateCrewApi } from "./modules/crew"
import { generateOrgAiModelProviderApi } from "./modules/org-ai-model-provider"
import { generateInitializationApi } from "./modules/initialization"

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
/** 超级麦吉 */
export const SuperMagicApi = generateSuperMagicApi(magicClient)
/** Skills */
export const SkillsApi = generateSkillsApi(magicClient)
/** Crew */
export const CrewApi = generateCrewApi(magicClient)

/** Org AI Model Provider (organization admin) */
export const OrgAiModelProviderApi = generateOrgAiModelProviderApi(magicClient)

/** Initialization (first-time setup) */
export const InitializationApi = generateInitializationApi(magicClient)
