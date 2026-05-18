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
import { MagicFilesApi } from "./MagicFilesApi"
import { MagicAgentApi } from "./MagicAgentApi"

export function installMagicAPI(): void {
	if (typeof window === "undefined") return
	new MagicFSApi().install()
	new MagicLLMApi().install()
	new MagicReloadApi().install()
	new MagicInputApi().install()
	new MagicI18nApi().install()
	new MagicFilesApi().install()
	new MagicAgentApi().install()
}
