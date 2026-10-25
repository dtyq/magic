import { LockKeyhole, MessageSquare, Terminal } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
	HelpIllustration,
	type HelpStep,
} from "@/components/shadcn-composed/context-help/HelpIllustration"
import type { AttachmentItem } from "../TopicFilesButton/hooks/types"
import { FileDirectoryView } from "../TopicFilesButton/components/FileDirectoryView"

// 说明中的固定目录示例只渲染图标，不查询用户文件或推断其是否存在。
const EXAMPLE_FOLDERS: AttachmentItem[] = [
	{ name: ".magic", relative_file_path: ".magic", is_directory: true },
	{ name: "memory", relative_file_path: ".magic/memory", is_directory: true },
	{ name: ".dws", relative_file_path: ".dws", is_directory: true },
	{ name: ".lark-cli", relative_file_path: ".lark-cli", is_directory: true },
	{ name: ".local", relative_file_path: ".local", is_directory: true },
]

/** 用户空间的静态说明；开关、面板布局和焦点恢复由共同帮助入口负责。 */
export default function UserSpaceHelpContent() {
	const { t } = useTranslation("super")
	const descriptions = [
		t("topicFiles.systemFiles.help.userMagic"),
		t("userSpace.fileHelp.memory"),
		t("userSpace.fileHelp.dingtalk"),
		t("userSpace.fileHelp.lark"),
		t("userSpace.fileHelp.tools"),
	]
	return (
		<>
			<p>{t("userSpace.help.introduction")}</p>
			<HelpIllustration
				title={t("userSpace.help.workspaceTitle")}
				steps={t("userSpace.help.workspaceSteps", { returnObjects: true }) as HelpStep[]}
				variant="flow"
			/>
			<p>{t("userSpace.help.workspaceDescription")}</p>
			<section className="space-y-3 rounded-xl border bg-muted/30 p-5">
				<h3 className="flex items-center gap-2 font-semibold">
					<LockKeyhole size={16} className="shrink-0" />
					{t("userSpace.help.privacyTitle")}
				</h3>
				<p>{t("userSpace.help.privacy")}</p>
				<p className="text-muted-foreground">{t("userSpace.help.sharedContent")}</p>
				<p className="text-muted-foreground">{t("userSpace.help.credentials")}</p>
			</section>
			<section className="space-y-2">
				<h3 className="font-semibold">{t("userSpace.help.foldersTitle")}</h3>
				<p className="text-muted-foreground">{t("userSpace.help.foldersDescription")}</p>
				<FileDirectoryView
					mode="example"
					items={[
						{ ...EXAMPLE_FOLDERS[0], children: [EXAMPLE_FOLDERS[1]] },
						...EXAMPLE_FOLDERS.slice(2),
					]}
					rootName={t("topicFiles.helpDirectoryExample")}
					fileHelpContext={{ kind: "user" }}
					descriptions={Object.fromEntries(
						EXAMPLE_FOLDERS.map((item, index) => [
							item.relative_file_path ?? "",
							descriptions[index],
						]),
					)}
				/>
			</section>
			<section className="space-y-4">
				<h3 className="flex items-center gap-2 font-semibold">
					<Terminal size={16} aria-hidden />
					{t("userSpace.help.cliTitle")}
				</h3>
				<p>{t("userSpace.help.cliDescription")}</p>
				<HelpIllustration
					title={t("userSpace.help.cliFlowTitle")}
					steps={t("userSpace.help.cliSteps", { returnObjects: true }) as HelpStep[]}
					variant="flow"
				/>
				<p>{t("userSpace.help.cliConfiguration")}</p>
				<p className="text-muted-foreground">{t("userSpace.help.cliAvailability")}</p>
			</section>
			<section className="space-y-2">
				<h3 className="font-semibold">{t("userSpace.help.examplesTitle")}</h3>
				<div className="space-y-3 rounded-lg border p-5">
					<MessageSquare size={16} aria-hidden className="text-primary" />
					<p className="font-medium">{t("userSpace.help.memoryExample")}</p>
					<p className="text-muted-foreground">{t("userSpace.help.memoryResult")}</p>
				</div>
				<div className="space-y-3 rounded-lg border p-5">
					<MessageSquare size={16} aria-hidden className="text-primary" />
					<p className="font-medium">{t("userSpace.help.filesExample")}</p>
					<p className="text-muted-foreground">{t("userSpace.help.filesResult")}</p>
				</div>
				<div className="space-y-3 rounded-lg border p-5">
					<MessageSquare size={16} aria-hidden className="text-primary" />
					<p className="font-medium">{t("userSpace.help.configExample")}</p>
					<p className="text-muted-foreground">{t("userSpace.help.configResult")}</p>
				</div>
			</section>
			<section className="space-y-1">
				<h3 className="font-semibold">{t("userSpace.help.unfamiliarTitle")}</h3>
				<p className="text-muted-foreground">{t("userSpace.help.unfamiliar")}</p>
			</section>
		</>
	)
}
