import type { ProjectActionKey } from "@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions"

const COMPACT_MOBILE_SHELL_ACTION_KEYS: ProjectActionKey[] = ["rename", "move", "delete"]

/**
 * 侧栏里的最近项目菜单默认保持精简动作，避免在窄视口里暴露过多入口。
 */
export function useMobileShellVisibleActionKeys(): ProjectActionKey[] {
	return COMPACT_MOBILE_SHELL_ACTION_KEYS
}