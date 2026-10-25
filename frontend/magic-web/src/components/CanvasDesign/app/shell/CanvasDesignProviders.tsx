import { useRef, forwardRef, useState, useCallback } from "react"
import UIProvider from "../../ui/primitives/custom/UIProvider"
import { CanvasProvider } from "../providers/CanvasProvider"
import { CanvasUIProvider } from "../providers/CanvasUIProvider"
import { ElementToolStateProvider } from "../providers/ElementToolStateProvider"
import { LayersUIProvider } from "../providers/LayersUIProvider"
import { ElementMenuProvider } from "../../ui/panels/menu/ElementMenuProvider"
import { ConnectionMenuProvider } from "../../ui/panels/menu/ConnectionMenuProvider"
import { MediaReplaceMenuProvider } from "../../ui/panels/media/MediaReplaceMenuProvider"
import { MagicProvider } from "../providers/MagicProvider"
import { PortalContainerProvider } from "../../ui/primitives/custom/PortalContainerContext"
import { CanvasDesignI18nProvider } from "../providers/I18nProvider"
import { HostUiLocaleProvider } from "../providers/HostUiLocaleProvider"
import type { CanvasDesignRef, CanvasDesignProps } from "../../public/props"
import CanvasDesignContent from "./CanvasDesignContent"

import styles from "./index.module.css"

const CanvasDesign = forwardRef<CanvasDesignRef, CanvasDesignProps>((props, ref) => {
	const { getDevice } = props

	const appContainerRef = useRef<HTMLDivElement | null>(null)

	const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)

	const setAppContainerRef = useCallback((node: HTMLDivElement | null) => {
		appContainerRef.current = node
		if (node) {
			setPortalContainer(node)
		}
	}, [])

	return (
		<CanvasProvider>
			<MagicProvider
				methods={props.magic?.methods}
				permissions={props.magic?.permissions}
				hostUiLocale={props.magic?.hostUiLocale}
				videoPointsEstimateCacheScope={props.magic?.videoPointsEstimateCacheScope}
				projectAttachmentMentionTree={props.data?.projectAttachmentMentionTree}
				defaultProjectAttachmentFolderId={props.data?.defaultProjectAttachmentFolderId}
				defaultProjectAttachmentFolderName={props.data?.defaultProjectAttachmentFolderName}
				mentionDataServiceCtor={props.data?.mentionDataServiceCtor}
				mentionExtension={props.data?.mentionExtension}
				referenceResourcePanelRenderer={props.data?.referenceResourcePanelRenderer}
			>
				<UIProvider>
					<CanvasDesignI18nProvider t={props.t}>
						<HostUiLocaleProvider locale={props.magic?.hostUiLocale}>
							<PortalContainerProvider value={portalContainer}>
								<div
									ref={setAppContainerRef}
									className={styles.appContainer}
									data-canvas-design-app-container
									data-canvas-ui-component
								>
									<ElementToolStateProvider>
										<CanvasUIProvider>
											<ElementMenuProvider>
												<ConnectionMenuProvider>
													<MediaReplaceMenuProvider>
														<LayersUIProvider getDevice={getDevice}>
															<CanvasDesignContent
																ref={ref}
																{...props}
															/>
														</LayersUIProvider>
													</MediaReplaceMenuProvider>
												</ConnectionMenuProvider>
											</ElementMenuProvider>
										</CanvasUIProvider>
									</ElementToolStateProvider>
								</div>
							</PortalContainerProvider>
						</HostUiLocaleProvider>
					</CanvasDesignI18nProvider>
				</UIProvider>
			</MagicProvider>
		</CanvasProvider>
	)
})

export default CanvasDesign
