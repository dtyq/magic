import type { PersonaResearchStore } from "../store/research-store"
import { createProjectTextFile } from "./projectFileWriter"
import { TEMPLATES_DIR, getAttachmentPath, reportTemplateName } from "./researchFiles"

/**
 * Report templates the user uploads. A template only sets the report's look, so any complete
 * HTML page works; the agent applies the same rules again when it reads the file.
 *
 * | Check     | Rejects                                   |
 * | type      | anything but .html / .htm                  |
 * | size      | files over 200 KB (they enter the model context) |
 * | notHtml   | text without <html or <body                |
 */
export const MAX_TEMPLATE_BYTES = 200 * 1024

export type TemplateFileProblem = "type" | "size" | "notHtml"

export function checkTemplateFile(file: {
	name: string
	size: number
}): TemplateFileProblem | null {
	if (!/\.html?$/i.test(file.name)) return "type"
	if (file.size > MAX_TEMPLATE_BYTES) return "size"
	return null
}

export function looksLikeHtml(text: string): boolean {
	return /<(html|body)[\s>]/i.test(text)
}

/**
 * A free file name in templates/, keeping the user's name.
 * Example: "Brand Report.htm" with brand report.html taken → "Brand Report-2.html".
 */
export function freeTemplateFileName(uploadName: string, existingPaths: string[]): string {
	const base =
		uploadName
			.replace(/\.html?$/i, "")
			.replace(/[\\/:*?"<>|]+/g, "-")
			.trim() || "template"
	const taken = new Set(existingPaths.map((path) => reportTemplateName(path).toLowerCase()))
	let name = base
	for (let index = 2; taken.has(name.toLowerCase()); index += 1) name = `${base}-${index}`
	return `${name}.html`
}

export type TemplateUploadResult =
	{ ok: true; fileName: string } | { ok: false; problem: TemplateFileProblem | "failed" }

export async function uploadReportTemplate(
	store: PersonaResearchStore,
	file: File,
): Promise<TemplateUploadResult> {
	const problem = checkTemplateFile(file)
	if (problem) return { ok: false, problem }
	const content = await file.text()
	if (!looksLikeHtml(content)) return { ok: false, problem: "notHtml" }
	const fileName = freeTemplateFileName(
		file.name,
		store.reportTemplates.map((item) => getAttachmentPath(item)),
	)
	const saved = await createProjectTextFile(store, TEMPLATES_DIR, fileName, content)
	return saved ? { ok: true, fileName } : { ok: false, problem: "failed" }
}
