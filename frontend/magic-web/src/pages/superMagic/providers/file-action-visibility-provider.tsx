import { createContext, useContext, useMemo, type PropsWithChildren } from "react"

export interface FileActionVisibility {
	hideCopyTo?: boolean
	hideMoveTo?: boolean
	hideShare?: boolean
	hideAddToNewChat?: boolean
}

interface FileActionVisibilityProviderProps extends PropsWithChildren {
	value?: FileActionVisibility
}

const defaultFileActionVisibility: Required<FileActionVisibility> = {
	hideCopyTo: false,
	hideMoveTo: false,
	hideShare: false,
	hideAddToNewChat: false,
}

export const HIDE_COPY_MOVE_SHARE_FILE_ACTIONS: FileActionVisibility = {
	hideCopyTo: true,
	hideMoveTo: true,
	hideShare: true,
}

export const HIDE_CLAW_FILE_ACTIONS: FileActionVisibility = {
	...HIDE_COPY_MOVE_SHARE_FILE_ACTIONS,
	hideAddToNewChat: true,
}

const FileActionVisibilityContext = createContext(defaultFileActionVisibility)

export function FileActionVisibilityProvider({
	children,
	value,
}: FileActionVisibilityProviderProps) {
	const contextValue = useMemo(
		() => ({
			hideCopyTo: value?.hideCopyTo ?? false,
			hideMoveTo: value?.hideMoveTo ?? false,
			hideShare: value?.hideShare ?? false,
			hideAddToNewChat: value?.hideAddToNewChat ?? false,
		}),
		[value?.hideAddToNewChat, value?.hideCopyTo, value?.hideMoveTo, value?.hideShare],
	)

	return (
		<FileActionVisibilityContext.Provider value={contextValue}>
			{children}
		</FileActionVisibilityContext.Provider>
	)
}

export function useFileActionVisibility() {
	return useContext(FileActionVisibilityContext)
}
