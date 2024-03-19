import { User } from "@/opensource/types/user"
import { Platform } from "../const/platform"

export interface PlatformServiceInterface {
	PlatformType: Platform

	initUserData: (magicUser: User.UserInfo) => Promise<void>
}

export interface MagicPlatformServiceInterface extends PlatformServiceInterface {
	initChatDataIfNeeded: (magicUser?: User.UserInfo) => Promise<void>
}

export interface APIPlatformServiceInterface extends PlatformServiceInterface {}

export interface AdminPlatformServiceInterface extends PlatformServiceInterface {}
