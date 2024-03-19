import type { User } from "@/opensource/types/user"
import type { Common } from "@/opensource/types/common"

/**
 * Get platform name from account deploy code and cluster config
 *
 * @param account - User account information
 * @param clustersConfig - Cluster configuration map
 * @param defaultName - Default platform name (usually from i18n)
 * @returns Platform name string
 */
export function getPlatformName(
	account: User.UserAccount,
	clustersConfig?: Record<string, Common.PrivateConfig>,
	defaultName?: string,
): string {
	if (account.deployCode && clustersConfig?.[account.deployCode]?.name) {
		return clustersConfig[account.deployCode].name!
	}
	return defaultName || ""
}
