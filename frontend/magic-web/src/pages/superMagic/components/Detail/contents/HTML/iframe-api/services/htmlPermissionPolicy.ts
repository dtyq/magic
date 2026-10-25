import { HTML_PERMISSION_SCOPES, type HtmlPermissionScope } from "../types"

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export type HtmlPermissionTtl = number | null
export type HtmlPermissionMode = "manifest" | "legacy"

export interface HtmlPermissionTtlOption {
	labelKey: string
	ttlMs: HtmlPermissionTtl
}

const TTL_OPTIONS = {
	once: { labelKey: "htmlEditor.permissionAuthorizationConfirm.ttl.once", ttlMs: 0 },
	"1h": { labelKey: "htmlEditor.permissionAuthorizationConfirm.ttl.60m", ttlMs: HOUR_MS },
	"8h": { labelKey: "htmlEditor.permissionAuthorizationConfirm.ttl.8h", ttlMs: 8 * HOUR_MS },
	"1d": { labelKey: "htmlEditor.permissionAuthorizationConfirm.ttl.1d", ttlMs: DAY_MS },
	"7d": { labelKey: "htmlEditor.permissionAuthorizationConfirm.ttl.7d", ttlMs: 7 * DAY_MS },
	"30d": { labelKey: "htmlEditor.permissionAuthorizationConfirm.ttl.30d", ttlMs: 30 * DAY_MS },
	always: { labelKey: "htmlEditor.permissionAuthorizationConfirm.ttl.always", ttlMs: null },
} satisfies Record<string, HtmlPermissionTtlOption>

type HtmlPermissionTtlOptionKey = keyof typeof TTL_OPTIONS

const TTL_OPTION_ORDER: HtmlPermissionTtlOption[] = permissionTtlOptions(
	"once",
	"1h",
	"8h",
	"1d",
	"7d",
	"30d",
	"always",
)

export const SUPPORTED_HTML_PERMISSION_SCOPES = Object.values(HTML_PERMISSION_SCOPES)
const SUPPORTED_SCOPE_SET = new Set<string>(SUPPORTED_HTML_PERMISSION_SCOPES)

const MANIFEST_TTL_OPTIONS: Record<HtmlPermissionScope, HtmlPermissionTtlOption[]> = {
	"llm.use": permissionTtlOptions("1h", "8h", "1d", "7d", "30d"),
	"project.message.write": permissionTtlOptions("once", "1h", "8h", "1d", "7d"),
	"project.files.upload": permissionTtlOptions("1h", "8h", "1d", "7d", "30d"),
	"project.files.download": permissionTtlOptions("1h", "1d", "7d", "30d"),
	"fs.project.read": permissionTtlOptions("1h", "1d", "7d", "30d"),
	"fs.project.write": permissionTtlOptions("once", "1h", "8h", "1d", "7d"),
	"user.profile.name": permissionTtlOptions("1d", "7d", "30d", "always"),
	"user.profile.identity": permissionTtlOptions("1h", "1d", "7d", "30d"),
	"user.profile.organization": permissionTtlOptions("1d", "7d", "30d", "always"),
}

const LEGACY_DEFAULT_OPTIONS = permissionTtlOptions("1h", "8h", "1d", "always")
const LEGACY_WRITE_OPTIONS = permissionTtlOptions("once", "1h", "8h", "always")

const LEGACY_TTL_OPTIONS: Record<HtmlPermissionScope, HtmlPermissionTtlOption[]> = {
	"llm.use": LEGACY_DEFAULT_OPTIONS,
	"project.message.write": LEGACY_WRITE_OPTIONS,
	"project.files.upload": LEGACY_DEFAULT_OPTIONS,
	"project.files.download": LEGACY_DEFAULT_OPTIONS,
	"fs.project.read": LEGACY_DEFAULT_OPTIONS,
	"fs.project.write": LEGACY_WRITE_OPTIONS,
	"user.profile.name": LEGACY_DEFAULT_OPTIONS,
	"user.profile.identity": LEGACY_DEFAULT_OPTIONS,
	"user.profile.organization": LEGACY_DEFAULT_OPTIONS,
}

const MANIFEST_DEFAULT_TTL_BY_SCOPE: Record<HtmlPermissionScope, HtmlPermissionTtl> = {
	"llm.use": DAY_MS,
	"project.message.write": HOUR_MS,
	"project.files.upload": DAY_MS,
	"project.files.download": 7 * DAY_MS,
	"fs.project.read": 7 * DAY_MS,
	"fs.project.write": HOUR_MS,
	"user.profile.name": 7 * DAY_MS,
	"user.profile.identity": 7 * DAY_MS,
	"user.profile.organization": 7 * DAY_MS,
}

const LEGACY_DEFAULT_TTL_BY_SCOPE: Record<HtmlPermissionScope, HtmlPermissionTtl> = {
	"llm.use": HOUR_MS,
	"project.message.write": 0,
	"project.files.upload": HOUR_MS,
	"project.files.download": HOUR_MS,
	"fs.project.read": HOUR_MS,
	"fs.project.write": 0,
	"user.profile.name": HOUR_MS,
	"user.profile.identity": HOUR_MS,
	"user.profile.organization": HOUR_MS,
}

/**
 * Scopes that write data, send content outwards or spend quota. Their grants are re-confirmed
 * after the app's executable files change, because edits (including agent edits) could otherwise
 * reuse the grant for behavior the user never saw. Read-only scopes keep silent reuse.
 */
const HIGH_RISK_SCOPE_SET = new Set<HtmlPermissionScope>([
	"fs.project.write",
	"project.message.write",
	"project.files.upload",
	"llm.use",
])

export function isHighRiskHtmlPermissionScope(scope: HtmlPermissionScope): boolean {
	return HIGH_RISK_SCOPE_SET.has(scope)
}

export function isSupportedHtmlPermissionScope(scope: string): scope is HtmlPermissionScope {
	return SUPPORTED_SCOPE_SET.has(scope)
}

export function getSharedHtmlPermissionTtlOptions(
	scopes: HtmlPermissionScope[],
	mode: HtmlPermissionMode,
): HtmlPermissionTtlOption[] {
	if (scopes.length === 0) return []
	const source = mode === "legacy" ? LEGACY_TTL_OPTIONS : MANIFEST_TTL_OPTIONS

	// Use a single canonical order so requesting the same scopes in another order cannot change the UI.
	return TTL_OPTION_ORDER.filter((option) =>
		scopes.every((scope) =>
			source[scope].some((candidate) => candidate.ttlMs === option.ttlMs),
		),
	)
}

export function getHtmlPermissionOnceTtlOption(): HtmlPermissionTtlOption {
	return TTL_OPTIONS.once
}

export function getDefaultHtmlPermissionTtl(
	scopes: HtmlPermissionScope[],
	mode: HtmlPermissionMode,
	ttlOptions: HtmlPermissionTtlOption[],
): HtmlPermissionTtl {
	if (scopes.length === 0) return ttlOptions[0]?.ttlMs ?? 0
	const defaults = mode === "legacy" ? LEGACY_DEFAULT_TTL_BY_SCOPE : MANIFEST_DEFAULT_TTL_BY_SCOPE
	const mostRestrictiveDefault = scopes
		.map((scope) => defaults[scope])
		.reduce((current, candidate) =>
			permissionTtlRank(candidate) < permissionTtlRank(current) ? candidate : current,
		)

	if (ttlOptions.some((option) => option.ttlMs === mostRestrictiveDefault)) {
		return mostRestrictiveDefault
	}

	const compatibleOptions = ttlOptions.filter(
		(option) => permissionTtlRank(option.ttlMs) <= permissionTtlRank(mostRestrictiveDefault),
	)
	return compatibleOptions.at(-1)?.ttlMs ?? ttlOptions[0]?.ttlMs ?? 0
}

export function serializeHtmlPermissionTtl(ttlMs: HtmlPermissionTtl): string {
	return ttlMs === null ? "always" : String(ttlMs)
}

export function parseHtmlPermissionTtl(value: string): HtmlPermissionTtl {
	return value === "always" ? null : Number(value)
}

function permissionTtlOptions(...keys: HtmlPermissionTtlOptionKey[]): HtmlPermissionTtlOption[] {
	return keys.map((key) => TTL_OPTIONS[key])
}

function permissionTtlRank(ttlMs: HtmlPermissionTtl): number {
	return ttlMs === null ? Number.POSITIVE_INFINITY : ttlMs
}
