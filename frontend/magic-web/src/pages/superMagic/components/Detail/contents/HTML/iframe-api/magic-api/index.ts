/**
 * magic-api
 *
 * 向 window.Magic.fs 和 window.Magic.llm 注入 postMessage 实现。
 * 作为 HTML sandbox 聚合入口的一部分编译，不单独构建。
 */

import type { RuntimePluginClass } from "@dtyq/html-sandbox"
import { MagicFSApi } from "./MagicFSApi"
import { MagicLLMApi } from "./MagicLLMApi"
import { MagicReloadApi } from "./MagicReloadApi"
import { MagicInputApi } from "./MagicInputApi"
import { MagicI18nApi } from "./MagicI18nApi"
import { MagicAgentApi } from "./MagicAgentApi"
import { MagicWorkspaceApi } from "./MagicWorkspaceApi"
import { MagicUserApi } from "./MagicUserApi"
import { MagicDatabaseApi } from "./MagicDatabaseApi"
import { MagicContextApi } from "./MagicContextApi"

/**
 * Magic API 插件包。由 runtime 的 composition root 注册安装，
 * 本模块不直接触发任何安装副作用。
 */
export const magicApiPlugins: RuntimePluginClass[] = [
	MagicFSApi,
	MagicLLMApi,
	MagicReloadApi,
	MagicInputApi,
	MagicI18nApi,
	MagicWorkspaceApi,
	MagicAgentApi,
	MagicUserApi,
	MagicContextApi,
	MagicDatabaseApi,
]
