import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Maximize2 } from "lucide-react"
import { useIsMobile } from "@/hooks/useIsMobile"
import desktopTutorial from "@/assets/resources/wechat-chat-history/desktop-tutorial.webp"
import mobileTutorial from "@/assets/resources/wechat-chat-history/mobile-tutorial.webp"
import filesTutorial from "@/assets/resources/wechat-chat-history/files-tutorial-v01.webp"
import linksTutorial from "@/assets/resources/wechat-chat-history/links-tutorial-v01.webp"
import TutorialPreview, { type TutorialImage } from "./TutorialPreview"

export default function PasteGuide() {
	const { t } = useTranslation("super")
	const mobile = useIsMobile()
	const [previewIndex, setPreviewIndex] = useState<number | null>(null)
	const previewTrigger = useRef<HTMLButtonElement | null>(null)
	const images: TutorialImage[] = [
		{
			src: mobile ? mobileTutorial : desktopTutorial,
			title: t("wechatChat.copyGuideTitle"),
			alt: mobile ? t("wechatChat.mobileGuideAlt") : t("wechatChat.desktopGuideAlt"),
		},
		{
			src: filesTutorial,
			title: t("wechatChat.filesGuideTitle"),
			alt: t("wechatChat.filesGuideAlt"),
		},
		{
			src: linksTutorial,
			title: t("wechatChat.linksGuideTitle"),
			alt: t("wechatChat.linksGuideAlt"),
		},
	]
	const modifier = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
		? "⌘"
		: "Ctrl"
	return (
		<section className="mx-auto max-w-3xl p-5">
			<h3 className="text-sm font-medium">{t("wechatChat.guideTitle")}</h3>
			<p className="mb-4 mt-2 text-xs leading-6 text-muted-foreground">
				{mobile
					? t("wechatChat.mobileGuide")
					: t("wechatChat.desktopGuide", { shortcut: `${modifier} V` })}
			</p>
			<p className="mt-3 text-xs leading-6 text-muted-foreground">
				{t("wechatChat.mediaGuide")}
			</p>
			<div className="mt-4 space-y-4">
				{images.map((image, index) => (
					<button
						key={image.src}
						type="button"
						className="block w-full overflow-hidden rounded-lg border border-border text-left outline-none transition-colors hover:border-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						onClick={(event) => {
							previewTrigger.current = event.currentTarget
							setPreviewIndex(index)
						}}
					>
						<img
							src={image.src}
							alt={image.alt}
							loading="lazy"
							className="max-h-80 w-full bg-muted/30 object-contain"
						/>
						<span className="flex items-center justify-between gap-3 border-t px-3 py-2 text-xs">
							<span>{image.title}</span>
							<span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
								<Maximize2 className="size-4" aria-hidden="true" />
								{t("wechatChat.enlargeGuide")}
							</span>
						</span>
					</button>
				))}
			</div>
			{previewIndex !== null && (
				<TutorialPreview
					images={images}
					index={previewIndex}
					onIndexChange={setPreviewIndex}
					onClose={() => setPreviewIndex(null)}
					trigger={previewTrigger.current}
				/>
			)}
		</section>
	)
}
