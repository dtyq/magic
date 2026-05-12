import soulMdBase from "../../assets/file-tree-icons/soul-md-base.svg"
import soulMdOverlay from "../../assets/file-tree-icons/soul-md-overlay.svg"
import { LayeredIcon } from "./FileTreeIconPrimitives"

export function SoulFileIcon() {
	return (
		<LayeredIcon
			baseSrc={soulMdBase}
			name="soul-md"
			overlaySrc={soulMdOverlay}
			overlayWrapperClassName="bottom-[20.83%] left-[20.83%] right-1/4 top-[20.83%]"
		/>
	)
}
