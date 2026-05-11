import { createContext, useContext, useMemo, type PropsWithChildren } from "react"

export interface FileActionVisibility {
	hideCopyTo?: boolean
	hideMoveTo?: boolean
	hideShareFile?: boolean
	hideShareTopic?: boolean
	hideCreateNewTopic?: boolean
}

interface FileActionVisibilityProviderProps extends PropsWithChildren {
	value?: FileActionVisibility
}

const defaultFileActionVisibility: Required<FileActionVisibility> = {
	hideCopyTo: false,
	hideMoveTo: false,
	hideShareFile: false,
	hideShareTopic: false,
	hideCreateNewTopic: false,
}

export const HIDE_COPY_MOVE_SHARE_FILE_ACTIONS: FileActionVisibility = {
	hideCopyTo: false,
	hideMoveTo: false,
	hideShareFile: false,
}

export const HIDE_COPY_MOVE_SHARE_FILE_AND_TOPIC_ACTIONS: FileActionVisibility = {
	...HIDE_COPY_MOVE_SHARE_FILE_ACTIONS,
	hideShareTopic: true,
}

export const HIDE_CLAW_FILE_ACTIONS: FileActionVisibility = {
	...HIDE_COPY_MOVE_SHARE_FILE_AND_TOPIC_ACTIONS,
	hideCreateNewTopic: true,
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
			hideShareFile: value?.hideShareFile ?? false,
			hideShareTopic: value?.hideShareTopic ?? false,
			hideCreateNewTopic: value?.hideCreateNewTopic ?? false,
		}),
		[
			value?.hideCopyTo,
			value?.hideCreateNewTopic,
			value?.hideMoveTo,
			value?.hideShareFile,
			value?.hideShareTopic,
		],
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
