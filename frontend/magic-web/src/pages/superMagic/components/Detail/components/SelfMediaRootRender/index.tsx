import { Suspense, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { observer } from "mobx-react-lite"
import MagicSpin from "@/components/base/MagicSpin"
import { Flex } from "antd"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import type { SelfMediaPlatform } from "../../types"
import {
	SelfMediaPlatformChromeProvider,
	useSelfMediaPlatformChrome,
} from "./context/PlatformChromeContext"
import PlatformSwitcher from "./components/PlatformSwitcher"
import UnsupportedPlatform from "./components/UnsupportedPlatform"
import { getPlatformComponent } from "./platforms"
import { SelfMediaStoreProvider, useSelfMediaStore } from "./stores"
import type { SelfMediaRootRenderProps } from "./types"

/**
 * SelfMediaRootRender
 *
 * Hosts a `SelfMediaStoreProvider` that scopes a MobX `SelfMediaStore` to
 * the render tree below. All data + navigation state (slices / posts /
 * loading / active post + card / current view) lives in the store and is
 * driven by the upstream attachment tree via the store's `sync` lifecycle.
 *
 * The inner `observer` renders loading / unsupported; when a platform
 * shell mounts, the multi-platform switcher is portaled into the shell
 * header host via `SelfMediaPlatformChromeProvider`. Each platform
 * component consumes the store through `useSelfMediaStore()`.
 */
function SelfMediaRootRender(props: SelfMediaRootRenderProps) {
	const {
		data,
		attachments,
		attachmentList,
		className,
		saveEditContent,
		selectedProject,
		allowEdit = false,
	} = props
	const folderFileId = data?.file_id

	// Access array lengths so that this observer component re-renders when items
	// are added to / removed from MobX observable arrays. Without this, mutations
	// to the same array reference would be invisible to the provider's useEffect.
	void attachments?.length
	void attachmentList?.length

	return (
		<SelfMediaStoreProvider
			folderFileId={folderFileId}
			attachments={attachments}
			attachmentList={attachmentList}
			initialNavigation={data?.initialNavigation}
		>
			<SelfMediaPlatformChromeProvider>
				<SelfMediaRootRenderInner
					attachmentList={attachmentList || attachments}
					className={className}
					allowEdit={allowEdit}
					saveEditContent={saveEditContent}
					selectedProject={selectedProject}
				/>
			</SelfMediaPlatformChromeProvider>
		</SelfMediaStoreProvider>
	)
}

interface SelfMediaRootRenderInnerProps {
	attachmentList: SelfMediaRootRenderProps["attachmentList"]
	className?: string
	allowEdit?: boolean
	saveEditContent?: SelfMediaRootRenderProps["saveEditContent"]
	selectedProject?: SelfMediaRootRenderProps["selectedProject"]
}

const SelfMediaRootRenderInner = observer(function SelfMediaRootRenderInner({
	attachmentList,
	className,
	allowEdit,
	saveEditContent,
	selectedProject,
}: SelfMediaRootRenderInnerProps) {
	const { t } = useTranslation("super")
	const store = useSelfMediaStore()
	const { hostElement } = useSelfMediaPlatformChrome()

	const { platforms, resolvedPlatform: platform, rootLoading } = store

	const handleChangePlatform = useCallback(
		(next: SelfMediaPlatform) => {
			store.handleChangePlatform(next)
		},
		[store],
	)

	const PlatformComponent = useMemo(() => getPlatformComponent(platform), [platform])

	if (rootLoading) {
		return (
			<Flex
				justify="center"
				align="center"
				className={cn("h-full w-full bg-background", className)}
				data-testid="self-media-root-loading"
			>
				<MagicSpin spinning />
			</Flex>
		)
	}

	if (!PlatformComponent) {
		return (
			<div className={cn("h-full w-full", className)}>
				<UnsupportedPlatform platform={platform} />
			</div>
		)
	}

	const platformSwitcherNode =
		hostElement &&
		createPortal(
			<div className="flex items-center gap-2">
				{platforms.length > 1 && (
					<span className="text-xs text-muted-foreground">
						{t("detail.selfMedia.platform.switcher.label")}
					</span>
				)}
				<PlatformSwitcher
					platforms={platforms}
					activePlatform={platform}
					onChange={handleChangePlatform}
				/>
			</div>,
			hostElement,
		)

	return (
		<div className={cn("h-full w-full", className)} data-testid="self-media-root">
			{platformSwitcherNode}
			<Suspense
				fallback={
					<Flex justify="center" align="center" className="h-full w-full">
						<MagicSpin spinning />
					</Flex>
				}
			>
				<PlatformComponent
					platform={platform as SelfMediaPlatform}
					attachmentList={attachmentList}
					allowEdit={allowEdit}
					saveEditContent={saveEditContent}
					selectedProject={selectedProject}
				/>
			</Suspense>
		</div>
	)
})

export default observer(SelfMediaRootRender)
