/**
 * magic-api
 *
 * 向 window.Magic.fs 和 window.Magic.llm 注入 postMessage 实现。
 * 作为 iframe-runtime 的一部分编译，不单独构建。
 */

import { MagicFSApi } from "./MagicFSApi"
import { MagicLLMApi } from "./MagicLLMApi"
import { MagicReloadApi } from "./MagicReloadApi"
import { MagicInputApi } from "./MagicInputApi"
import { MagicI18nApi } from "./MagicI18nApi"
import { MagicAgentApi } from "./MagicAgentApi"
import { MagicWorkspaceApi } from "./MagicWorkspaceApi"

export function installMagicAPIs(): void {
	if (typeof window === "undefined") return
	new MagicFSApi().install()
	new MagicLLMApi().install()
	new MagicReloadApi().install()
	new MagicInputApi().install()
	new MagicI18nApi().install()
	new MagicWorkspaceApi().install()
	new MagicAgentApi().install()
}
