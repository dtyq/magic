import { generateChatApi } from "@/opensource/apis/modules/chat"
import { FunctionHub } from "./core/FunctionHub"
import openAccountModal from "@/opensource/pages/login/AccountModal"

export const enum DefaultFunction {
	openAccountModal = "openAccountModal",
}

export const defaultFunctions = [
	{
		name: DefaultFunction.openAccountModal,
		fn: openAccountModal,
		description: "Open the account modal",
	},
	{
		name: "generateChatApi",
		fn: generateChatApi,
		description: "Generate chat api",
	},
]

export function registerDefault(functionHub: FunctionHub) {
	// Register openAccountModal
	functionHub.register({
		name: DefaultFunction.openAccountModal,
		fn: openAccountModal,
		description: "Open the account modal",
	})

	// Register generateChatApi with proper types
	functionHub.register<
		[Parameters<typeof generateChatApi>[0], Parameters<typeof generateChatApi>[1]],
		ReturnType<typeof generateChatApi>
	>({
		name: "generateChatApi",
		fn: generateChatApi,
		description: "Generate chat api",
	})
}
