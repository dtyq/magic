import { htmlMicroAppPreviewLogger } from "../../utils/htmlMicroAppPreviewLogger"
import type { HTMLAppConfig, HtmlPermissionScope } from "../types"
import {
	createHtmlPermissionAppKey,
	type HtmlPermissionGrant,
	type HtmlPermissionGrantIdentity,
	type HtmlPermissionGrantStore,
} from "./HtmlPermissionGrantStore"
import {
	analyzeHtmlPermissionDeclarations,
	createEmptyHtmlPermissionDeclaration,
	type HtmlPermissionDeclarationAnalysis,
	type HtmlPermissionDiagnostic,
} from "./htmlPermissionDeclarations"
import {
	getDefaultHtmlPermissionTtl,
	getHtmlPermissionOnceTtlOption,
	getSharedHtmlPermissionTtlOptions,
	isHighRiskHtmlPermissionScope,
	SUPPORTED_HTML_PERMISSION_SCOPES,
	type HtmlPermissionMode,
	type HtmlPermissionTtl,
	type HtmlPermissionTtlOption,
} from "./htmlPermissionPolicy"
import { HtmlPermissionAuthorizationQueue } from "./HtmlPermissionAuthorizationQueue"
import {
	getSharedLegacyMigrationMarker,
	type HtmlPermissionLegacyMigrationMarker,
} from "./HtmlPermissionLegacyMigrationMarker"

export type { HtmlPermissionDiagnostic, HtmlPermissionTtlOption }

export interface HtmlPermissionAuthorizeOptions {
	reason?: string
	presentation?: "capability" | "userInfo"
	allowOnce?: boolean
}

export interface HtmlPermissionConfirmRequest {
	appName: string
	mode: HtmlPermissionMode
	isLegacy: boolean
	appConfigLoadError?: string
	scopes: HtmlPermissionScope[]
	reason: string
	presentation: "capability" | "userInfo"
	ttlOptions: HtmlPermissionTtlOption[]
	defaultTtlMs: HtmlPermissionTtl
	signal?: AbortSignal
}

export interface HtmlPermissionConfirmResult {
	allowed: boolean
	ttlMs: HtmlPermissionTtl
}

/** Asked when high-risk grants exist but the app's code changed after the user confirmed them. */
export interface HtmlPermissionCodeChangeConfirmRequest {
	appName: string
	scopes: HtmlPermissionScope[]
	signal?: AbortSignal
}

/**
 * - `remember`: keep the existing grant (same expiry) and trust future code versions for this scope.
 * - `once`: allow this call only; the grant stays tied to the previously confirmed code.
 * - `deny`: reject the call.
 */
export type HtmlPermissionCodeChangeDecision = "remember" | "once" | "deny"

export interface HtmlPermissionMissingDeclarationRequest {
	appName: string
	scope: HtmlPermissionScope
	declaredScopes: HtmlPermissionScope[]
}

export interface IframePermissionAppInstance {
	userId: string
	projectId: string
	appRootDir: string
	entryPath: string
	content: string
	/**
	 * Stable micro-app id. Grants are keyed on it (not on path or content), so editing,
	 * renaming or moving files keeps existing authorization.
	 */
	appId?: string
	/** Stable file id of the HTML entry for ordinary HTML apps without an `appId`. */
	entryFileId?: string
	/**
	 * Only used to locate grants saved by earlier versions, which were keyed on a content
	 * fingerprint. Prefer the lazy getter so the file list is not hashed on every render.
	 */
	runtimeFingerprint?: string
	getRuntimeFingerprint?: () => string
}

export type HtmlAppConfigState =
	| { status: "loading" }
	| { status: "absent" }
	| { status: "loaded"; config: HTMLAppConfig }
	| { status: "error"; error: string }

export type HtmlPermissionCodeStatus = "same" | "changed" | "unknown"

export interface HtmlPermissionSnapshotItem {
	scope: string
	supported: boolean
	declarationStatus: "declared" | "notDeclared" | "unsupported"
	grant?: HtmlPermissionGrant
	ttlOptions: HtmlPermissionTtlOption[]
	/** Whether this scope is re-confirmed after the app code changes. */
	highRisk: boolean
	/**
	 * Compares the code version recorded when the grant was confirmed with the current one.
	 * `unknown` means the grant predates code tracking.
	 */
	codeStatus: HtmlPermissionCodeStatus
	/** True when the next use of this scope will ask again because of a code change. */
	needsReconfirm: boolean
}

export interface HtmlPermissionSnapshot {
	configStatus: HtmlAppConfigState["status"]
	mode: HtmlPermissionMode | null
	app: {
		name: string
		version: string
		entry: string
		appRootDir: string
		reason: string
	}
	permissions: HtmlPermissionSnapshotItem[]
	diagnostics: HtmlPermissionDiagnostic[]
	activeGrantCount: number
	/** Number of active grants whose recorded code version differs from the current one. */
	codeChangedGrantCount: number
	/** Number of active high-risk grants that will ask again on next use. */
	needsReconfirmCount: number
}

export interface IframePermissionServiceConfig {
	grantStore: HtmlPermissionGrantStore
	confirmPermission: (
		request: HtmlPermissionConfirmRequest,
	) => Promise<HtmlPermissionConfirmResult>
	/** Without it, high-risk grants whose code changed are denied rather than silently reused. */
	confirmCodeChange?: (
		request: HtmlPermissionCodeChangeConfirmRequest,
	) => Promise<HtmlPermissionCodeChangeDecision>
	/** Defaults to a localStorage-backed marker shared by all services. */
	legacyMigrationMarker?: HtmlPermissionLegacyMigrationMarker
	onMissingDeclaration?: (request: HtmlPermissionMissingDeclarationRequest) => void
	onGrantsChanged?: () => void
	appConfigState: HtmlAppConfigState
	appInstance: IframePermissionAppInstance
	authorizationQueue?: HtmlPermissionAuthorizationQueue
	getNow?: () => number
}

export class IframePermissionService {
	private readonly cfg: IframePermissionServiceConfig
	private readonly authorizationQueue: HtmlPermissionAuthorizationQueue
	// Controllers share serialization across edits, but a new service must make its own decision.
	private readonly authorizationRequestKeys = new Map<string, object>()

	constructor(cfg: IframePermissionServiceConfig) {
		this.cfg = cfg
		this.authorizationQueue = cfg.authorizationQueue ?? new HtmlPermissionAuthorizationQueue()
	}

	async authorize(
		scope: HtmlPermissionScope,
		options: HtmlPermissionAuthorizeOptions = {},
	): Promise<boolean> {
		return this.authorizeMany([scope], options)
	}

	async authorizeMany(
		scopes: HtmlPermissionScope[],
		options: HtmlPermissionAuthorizeOptions = {},
	): Promise<boolean> {
		const requestedScopes = Array.from(new Set(scopes))
		if (requestedScopes.length === 0) return true

		return this.authorizationQueue.enqueue(
			this.createAuthorizationQueueKey(requestedScopes, options),
			(signal) => this.authorizeManyNow(requestedScopes, options, signal),
		)
	}

	dispose() {
		this.authorizationQueue.dispose()
	}

	private async authorizeManyNow(
		requestedScopes: HtmlPermissionScope[],
		options: HtmlPermissionAuthorizeOptions,
		signal: AbortSignal,
	): Promise<boolean> {
		if (this.authorizationQueue.isDisposed || signal.aborted) return false

		const now = this.getNow()

		const context = await this.resolveContext()
		if (!context || this.authorizationQueue.isDisposed || signal.aborted) return false

		const { appConfig, appConfigLoadError, mode, declaration } = context
		if (appConfigLoadError) {
			htmlMicroAppPreviewLogger.warn(
				"Permission fallback: app.json unavailable, using legacy confirmation",
				{ scopes: requestedScopes, error: appConfigLoadError },
			)
		}

		if (mode === "manifest") {
			const undeclaredScopes = requestedScopes.filter(
				(scope) => !declaration.declaredScopes.includes(scope),
			)
			if (undeclaredScopes.length > 0) {
				for (const scope of undeclaredScopes) {
					this.reportMissingDeclaration(scope, appConfig, declaration.declaredScopes)
				}
				return false
			}
		}

		const identity = this.buildGrantIdentity(mode)
		const persistenceAvailable =
			this.canPersistGrant(identity) && (await this.cfg.grantStore.isPersistentAvailable())
		if (this.authorizationQueue.isDisposed || signal.aborted) return false
		if (options.allowOnce === false && !persistenceAvailable) return false
		const existingGrants = await this.loadAppGrants(identity, mode, declaration.declaredScopes)
		if (this.authorizationQueue.isDisposed || signal.aborted) return false
		const existingScopes = new Set(existingGrants.map((grant) => grant.scope))
		const missingScopes = requestedScopes.filter((scope) => !existingScopes.has(scope))
		const codeFingerprint = await this.getCodeFingerprint()

		// Remembered consent follows the app and scope across edits. Other high-risk grants
		// still require a code-change decision; read-only grants remain silently reusable.
		if (options.allowOnce !== false) {
			const staleScopes = existingGrants
				.filter(
					(grant) =>
						requestedScopes.includes(grant.scope) &&
						grant.reuseAcrossCodeChanges !== true &&
						isHighRiskHtmlPermissionScope(grant.scope) &&
						(!codeFingerprint || grant.codeFingerprint !== codeFingerprint),
				)
				.map((grant) => grant.scope)
			if (staleScopes.length > 0) {
				if (!codeFingerprint) return false
				const decision = this.cfg.confirmCodeChange
					? await this.cfg.confirmCodeChange({
							appName: appConfig?.name || "",
							scopes: staleScopes,
							signal,
						})
					: "deny"
				if (this.authorizationQueue.isDisposed || signal.aborted) return false
				if (decision === "deny") return false
				if (decision === "remember") {
					await this.restampGrants(existingGrants, staleScopes, codeFingerprint, true)
					if (this.authorizationQueue.isDisposed || signal.aborted) return false
				}
			}
		}
		if (missingScopes.length === 0) return true

		const ttlOptions = persistenceAvailable
			? getSharedHtmlPermissionTtlOptions(missingScopes, mode).filter(
					(option) => options.allowOnce !== false || option.ttlMs !== 0,
				)
			: [getHtmlPermissionOnceTtlOption()]
		const result = await this.cfg.confirmPermission({
			appName: appConfig?.name || "",
			mode,
			isLegacy: mode === "legacy",
			appConfigLoadError,
			scopes: missingScopes,
			reason:
				options.reason ||
				appConfig?.permissions?.reason ||
				(options.presentation === "userInfo"
					? appConfig?.permissions?.userInfo?.reason
					: "") ||
				"",
			presentation: options.presentation || "capability",
			ttlOptions,
			defaultTtlMs: getDefaultHtmlPermissionTtl(missingScopes, mode, ttlOptions),
			signal,
		})

		if (this.authorizationQueue.isDisposed || signal.aborted) return false
		if (!result.allowed) return false
		if (!ttlOptions.some((option) => option.ttlMs === result.ttlMs)) {
			htmlMicroAppPreviewLogger.warn("Permission denied: selected duration is not allowed", {
				scopes: missingScopes,
				ttlMs: result.ttlMs,
			})
			return false
		}
		if (result.ttlMs !== 0 && persistenceAvailable) {
			let persisted = true
			for (const scope of missingScopes) {
				if (this.authorizationQueue.isDisposed || signal.aborted) return false
				const saved = await this.cfg.grantStore.save({
					...identity,
					scope,
					grantedAt: now,
					expiresAt: result.ttlMs === null ? null : now + result.ttlMs,
					codeFingerprint,
				})
				persisted = saved && persisted
				if (this.authorizationQueue.isDisposed || signal.aborted) return false
			}
			if (persisted) this.cfg.onGrantsChanged?.()
			else if (options.allowOnce === false) return false
		}
		return true
	}

	private createAuthorizationQueueKey(
		scopes: HtmlPermissionScope[],
		options: HtmlPermissionAuthorizeOptions,
	): object {
		const key = JSON.stringify({
			scopes: [...scopes].sort(),
			presentation: options.presentation || "capability",
			allowOnce: options.allowOnce === false ? false : true,
			runtimeFingerprint: normalizeRuntimeFingerprint(this.getRuntimeFingerprint()),
		})
		let requestKey = this.authorizationRequestKeys.get(key)
		if (!requestKey) {
			requestKey = {}
			this.authorizationRequestKeys.set(key, requestKey)
		}
		return requestKey
	}

	async getPermissionSnapshot(): Promise<HtmlPermissionSnapshot> {
		const configState = this.cfg.appConfigState
		if (configState.status === "loading") {
			return this.createSnapshot(null, null, createEmptyHtmlPermissionDeclaration(), [], "")
		}

		const appConfig = configState.status === "loaded" ? configState.config : null
		const mode: HtmlPermissionMode = appConfig ? "manifest" : "legacy"
		const declaration = analyzeHtmlPermissionDeclarations(appConfig)
		const identity = this.buildGrantIdentity(mode)
		const grants = await this.loadAppGrants(identity, mode, declaration.declaredScopes)

		return this.createSnapshot(
			mode,
			appConfig,
			declaration,
			grants,
			await this.getCodeFingerprint(),
		)
	}

	/**
	 * Marks the current code as confirmed for every active grant (the user accepted the changes).
	 * Expiry is kept; this never extends or broadens a grant.
	 */
	async acknowledgeCodeChanges(): Promise<HtmlPermissionSnapshot> {
		const context = await this.resolveContext()
		if (context) {
			const identity = this.buildGrantIdentity(context.mode)
			const grants = await this.loadAppGrants(
				identity,
				context.mode,
				context.declaration.declaredScopes,
			)
			await this.restampGrants(
				grants,
				grants.map((grant) => grant.scope),
				await this.getCodeFingerprint(),
			)
		}
		return this.getPermissionSnapshot()
	}

	async revoke(scope: HtmlPermissionScope): Promise<HtmlPermissionSnapshot> {
		const context = await this.resolveContext()
		if (context) {
			await this.cfg.grantStore.remove(this.buildGrantIdentity(context.mode), scope)
			// A revoked grant must not come back through legacy migration, now or after a reload.
			await this.removeLegacyGrants(context.mode, context.appConfig, scope)
			this.markLegacyMigrated(context.mode)
			this.cfg.onGrantsChanged?.()
		}
		return this.getPermissionSnapshot()
	}

	async updateGrantTtl(
		scope: HtmlPermissionScope,
		ttlMs: HtmlPermissionTtl,
	): Promise<HtmlPermissionSnapshot> {
		const now = this.getNow()

		const context = await this.resolveContext()
		if (!context) throw new Error("Permission context is not ready")

		const { mode, declaration } = context
		if (mode === "manifest" && !declaration.declaredScopes.includes(scope)) {
			throw new Error("Permission scope is not declared")
		}

		const ttlOptions = getSharedHtmlPermissionTtlOptions([scope], mode).filter(
			(option) => option.ttlMs !== 0,
		)
		if (
			(ttlMs !== null && !Number.isFinite(ttlMs)) ||
			!ttlOptions.some((option) => option.ttlMs === ttlMs)
		) {
			throw new Error("Permission duration is not allowed")
		}

		const identity = this.buildGrantIdentity(mode)
		const existingGrant = (
			await this.loadAppGrants(identity, mode, declaration.declaredScopes)
		).find((grant) => grant.scope === scope)
		if (!existingGrant) throw new Error("Active permission grant was not found")

		const saved = await this.cfg.grantStore.save({
			...identity,
			scope,
			grantedAt: now,
			expiresAt: ttlMs === null ? null : now + ttlMs,
			// Duration changes preserve both the confirmed version and explicit cross-version consent.
			codeFingerprint: existingGrant.codeFingerprint,
			reuseAcrossCodeChanges: existingGrant.reuseAcrossCodeChanges,
		})
		if (!saved) throw new Error("Permission grant could not be persisted")
		this.cfg.onGrantsChanged?.()
		return this.getPermissionSnapshot()
	}

	async revokeAll(): Promise<HtmlPermissionSnapshot> {
		const context = await this.resolveContext()
		if (context) {
			await this.cfg.grantStore.remove(this.buildGrantIdentity(context.mode))
			await this.removeLegacyGrants(context.mode, context.appConfig)
			this.markLegacyMigrated(context.mode)
			this.cfg.onGrantsChanged?.()
		}
		return this.getPermissionSnapshot()
	}

	private createSnapshot(
		mode: HtmlPermissionMode | null,
		appConfig: HTMLAppConfig | null,
		declaration: HtmlPermissionDeclarationAnalysis,
		grants: HtmlPermissionGrant[],
		currentCodeFingerprint: string,
	): HtmlPermissionSnapshot {
		const grantsByScope = new Map(grants.map((grant) => [grant.scope, grant]))
		const codeStatusOf = (grant: HtmlPermissionGrant | undefined): HtmlPermissionCodeStatus => {
			if (!grant) return "same"
			if (!currentCodeFingerprint || !grant.codeFingerprint) return "unknown"
			return grant.codeFingerprint === currentCodeFingerprint ? "same" : "changed"
		}
		const declaredScopeSet = new Set(declaration.declaredScopes)
		const diagnostics = [...declaration.diagnostics]
		if (this.cfg.appConfigState.status === "absent") {
			diagnostics.unshift({ code: "manifestAbsent" })
		} else if (this.cfg.appConfigState.status === "error") {
			diagnostics.unshift({
				code: "manifestLoadError",
				error: this.cfg.appConfigState.error,
			})
		}

		return {
			configStatus: this.cfg.appConfigState.status,
			mode,
			app: {
				name: appConfig?.name || "",
				version: appConfig?.version || "",
				entry: appConfig?.entry || this.cfg.appInstance.entryPath.split("/").pop() || "",
				appRootDir: this.cfg.appInstance.appRootDir,
				reason:
					appConfig?.permissions?.reason ||
					appConfig?.permissions?.userInfo?.reason ||
					"",
			},
			permissions: [
				...SUPPORTED_HTML_PERMISSION_SCOPES.map((scope) => ({
					scope,
					supported: true,
					declarationStatus: declaredScopeSet.has(scope)
						? ("declared" as const)
						: ("notDeclared" as const),
					grant: grantsByScope.get(scope),
					ttlOptions: mode
						? getSharedHtmlPermissionTtlOptions([scope], mode).filter(
								(option) => option.ttlMs !== 0,
							)
						: [],
					highRisk: isHighRiskHtmlPermissionScope(scope),
					codeStatus: codeStatusOf(grantsByScope.get(scope)),
					needsReconfirm:
						Boolean(grantsByScope.get(scope)) &&
						grantsByScope.get(scope)?.reuseAcrossCodeChanges !== true &&
						isHighRiskHtmlPermissionScope(scope) &&
						codeStatusOf(grantsByScope.get(scope)) !== "same",
				})),
				...declaration.unsupportedScopes.map((scope) => ({
					scope,
					supported: false,
					declarationStatus: "unsupported" as const,
					ttlOptions: [],
					highRisk: false,
					codeStatus: "same" as const,
					needsReconfirm: false,
				})),
			],
			diagnostics,
			activeGrantCount: grants.length,
			codeChangedGrantCount: grants.filter((grant) => codeStatusOf(grant) === "changed")
				.length,
			needsReconfirmCount: grants.filter(
				(grant) =>
					grant.reuseAcrossCodeChanges !== true &&
					isHighRiskHtmlPermissionScope(grant.scope) &&
					codeStatusOf(grant) !== "same",
			).length,
		}
	}

	private async resolveContext() {
		const appConfigState = this.cfg.appConfigState
		if (appConfigState.status === "loading") return null

		const appConfig = appConfigState.status === "loaded" ? appConfigState.config : null
		const mode: HtmlPermissionMode = appConfig ? "manifest" : "legacy"
		return {
			appConfig,
			mode,
			appConfigLoadError:
				appConfigState.status === "error" ? appConfigState.error : undefined,
			declaration: analyzeHtmlPermissionDeclarations(appConfig),
		}
	}

	private reportMissingDeclaration(
		scope: HtmlPermissionScope,
		appConfig: HTMLAppConfig | null,
		declaredScopes: HtmlPermissionScope[],
	) {
		const appName = appConfig?.name || ""
		htmlMicroAppPreviewLogger.warn("Permission blocked: scope not declared in app.json", {
			appName,
			declaredScopes,
			scope,
		})
		this.cfg.onMissingDeclaration?.({ appName, declaredScopes, scope })
	}

	/**
	 * Identity of the current app. It deliberately excludes file content and sibling files:
	 * code is edited constantly during development and must not invalidate authorization.
	 * Path fields are display-only; the key comes from `appId` / `entryFileId`.
	 */
	private buildGrantIdentity(mode: HtmlPermissionMode): HtmlPermissionGrantIdentity {
		return {
			mode,
			userId: this.cfg.appInstance.userId,
			projectId: this.cfg.appInstance.projectId,
			appRootDir: this.cfg.appInstance.appRootDir,
			entryPath: this.cfg.appInstance.entryPath,
			appFingerprint: "",
			appId: this.cfg.appInstance.appId || undefined,
			entryFileId: this.cfg.appInstance.appId
				? undefined
				: this.cfg.appInstance.entryFileId || undefined,
		}
	}

	/** Identity under which earlier versions stored grants (path + content fingerprint). */
	private async buildLegacyGrantIdentity(
		mode: HtmlPermissionMode,
		appConfig: HTMLAppConfig | null,
	): Promise<HtmlPermissionGrantIdentity> {
		return {
			mode,
			userId: this.cfg.appInstance.userId,
			projectId: this.cfg.appInstance.projectId,
			appRootDir: this.cfg.appInstance.appRootDir,
			entryPath: this.cfg.appInstance.entryPath,
			appFingerprint: await this.getLegacyAppFingerprint(mode, appConfig),
		}
	}

	private async getLegacyAppFingerprint(
		mode: HtmlPermissionMode,
		appConfig: HTMLAppConfig | null,
	): Promise<string> {
		const runtimeFingerprint =
			this.cfg.appInstance.runtimeFingerprint ??
			this.cfg.appInstance.getRuntimeFingerprint?.() ??
			""
		const source =
			mode === "manifest"
				? stableStringify({
						type: appConfig?.type || "",
						name: appConfig?.name || "",
						version: appConfig?.version || "",
						entry: appConfig?.entry || "",
						permissions: appConfig?.permissions || {},
						runtimeFingerprint,
						entryContent: this.cfg.appInstance.content || "",
					})
				: stableStringify({
						entryContent: this.cfg.appInstance.content || "",
						runtimeFingerprint,
					})
		return shortHash(source)
	}

	/**
	 * Version of the app's executable files (HTML/JS file id, path and update time). Content is not
	 * hashed: it may not be loaded yet, while file versions are available as soon as the project
	 * file list is. It is empty when the file list is not ready, so old high-risk grants cannot run.
	 */
	private codeFingerprintPromise: Promise<string> | null = null
	private codeFingerprintRuntime: string | null = null
	private getCodeFingerprint(): Promise<string> {
		const runtime = normalizeRuntimeFingerprint(this.getRuntimeFingerprint())
		if (this.codeFingerprintRuntime !== runtime || !this.codeFingerprintPromise) {
			this.codeFingerprintRuntime = runtime
			this.codeFingerprintPromise =
				runtime && runtime !== "[]" ? shortHash(`code:${runtime}`) : Promise.resolve("")
		}
		return this.codeFingerprintPromise
	}

	private getRuntimeFingerprint(): string {
		return (
			this.cfg.appInstance.runtimeFingerprint ??
			this.cfg.appInstance.getRuntimeFingerprint?.() ??
			""
		)
	}

	/** Keeps expiry and scope unchanged; only explicit remember also trusts future versions. */
	private async restampGrants(
		grants: HtmlPermissionGrant[],
		scopes: HtmlPermissionScope[],
		codeFingerprint: string,
		reuseAcrossCodeChanges = false,
	): Promise<void> {
		// An unavailable file list is not a reviewed code version; keep the last known stamp.
		if (!codeFingerprint) return
		let changed = false
		for (const grant of grants) {
			if (!scopes.includes(grant.scope)) continue
			if (
				grant.codeFingerprint === codeFingerprint &&
				(!reuseAcrossCodeChanges || grant.reuseAcrossCodeChanges === true)
			)
				continue
			const saved = await this.cfg.grantStore.save({
				...grant,
				codeFingerprint,
				...(reuseAcrossCodeChanges ? { reuseAcrossCodeChanges: true } : {}),
			})
			changed = saved || changed
		}
		if (changed) this.cfg.onGrantsChanged?.()
	}

	private getLegacyMigrationMarker(): HtmlPermissionLegacyMigrationMarker {
		return this.cfg.legacyMigrationMarker ?? getSharedLegacyMigrationMarker()
	}

	private markLegacyMigrated(mode: HtmlPermissionMode) {
		const identity = this.buildGrantIdentity(mode)
		if (this.canPersistGrant(identity)) {
			this.getLegacyMigrationMarker().add(createHtmlPermissionAppKey(identity))
		}
	}

	/**
	 * Reads grants for the stable identity and, once per app (persisted in a marker), adopts grants
	 * that earlier versions saved under a content fingerprint. Only grants whose fingerprint
	 * still matches the current content can be found (the old key is a one-way hash), so
	 * grants made for older edits simply expire. The original expiry is kept, never extended.
	 * Revoking also sets the marker, so a revoked grant cannot return if the file is reverted to
	 * an earlier version or the page is reloaded.
	 */
	private async loadAppGrants(
		identity: HtmlPermissionGrantIdentity,
		mode: HtmlPermissionMode,
		declaredScopes: HtmlPermissionScope[],
	): Promise<HtmlPermissionGrant[]> {
		const grants = await this.cfg.grantStore.getAppGrants(identity)
		if (!this.canPersistGrant(identity)) return grants

		const marker = this.getLegacyMigrationMarker()
		const migrationKey = createHtmlPermissionAppKey(identity)
		if (marker.has(migrationKey)) return grants
		// An empty file list means the project files are not loaded yet; the legacy key cannot match
		// then, so keep the migration pending instead of marking it done.
		const runtimeReady =
			this.getRuntimeFingerprint() !== "" && this.getRuntimeFingerprint() !== "[]"

		try {
			const appConfig =
				this.cfg.appConfigState.status === "loaded" ? this.cfg.appConfigState.config : null
			const legacyIdentity = await this.buildLegacyGrantIdentity(mode, appConfig)
			if (!legacyIdentity.appFingerprint) return grants
			const legacyGrants = await this.cfg.grantStore.getAppGrants(legacyIdentity)
			const knownScopes = new Set(grants.map((grant) => grant.scope))
			const adopted: HtmlPermissionGrant[] = []
			let migrationPersisted = true
			const codeFingerprint = await this.getCodeFingerprint()
			for (const legacy of legacyGrants) {
				if (knownScopes.has(legacy.scope)) continue
				if (mode === "manifest" && !declaredScopes.includes(legacy.scope)) continue
				const migrated: HtmlPermissionGrant = {
					...identity,
					scope: legacy.scope,
					grantedAt: legacy.grantedAt,
					expiresAt: legacy.expiresAt,
					// The legacy key only matches when the code is unchanged, so this version is confirmed.
					codeFingerprint: codeFingerprint || undefined,
				}
				if (await this.cfg.grantStore.save(migrated)) {
					adopted.push(migrated)
					await this.cfg.grantStore.remove(legacyIdentity, legacy.scope)
				} else {
					// Keep the old grant and retry later instead of permanently completing a failed copy.
					migrationPersisted = false
				}
			}
			if (runtimeReady && migrationPersisted) marker.add(migrationKey)
			return adopted.length > 0 ? [...grants, ...adopted] : grants
		} catch (error) {
			htmlMicroAppPreviewLogger.warn("Failed to migrate legacy permission grants", {
				error: error instanceof Error ? error.message : String(error),
			})
			return grants
		}
	}

	private async removeLegacyGrants(
		mode: HtmlPermissionMode,
		appConfig: HTMLAppConfig | null,
		scope?: HtmlPermissionScope,
	): Promise<void> {
		try {
			const legacyIdentity = await this.buildLegacyGrantIdentity(mode, appConfig)
			if (legacyIdentity.appFingerprint) {
				await this.cfg.grantStore.remove(legacyIdentity, scope)
			}
		} catch (error) {
			htmlMicroAppPreviewLogger.warn("Failed to remove legacy permission grants", {
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}

	private canPersistGrant(identity: HtmlPermissionGrantIdentity): boolean {
		// Without a stable id the grant cannot be tied to one app, so only one-time consent is offered.
		return Boolean(
			identity.userId && identity.projectId && (identity.appId || identity.entryFileId),
		)
	}

	private getNow() {
		return this.cfg.getNow?.() ?? Date.now()
	}
}

function stableStringify(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
	if (value && typeof value === "object") {
		return `{${Object.keys(value as Record<string, unknown>)
			.sort()
			.map(
				(key) =>
					`${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
			)
			.join(",")}}`
	}
	return JSON.stringify(value)
}

async function shortHash(value: string): Promise<string> {
	const subtle = globalThis.crypto?.subtle
	if (subtle) {
		const bytes = new TextEncoder().encode(value)
		const digest = await subtle.digest("SHA-256", bytes)
		return Array.from(new Uint8Array(digest).slice(0, 16))
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("")
	}
	return ""
}

/**
 * The merged project file list can contain one file twice. The legacy key was built from that raw
 * list and must keep matching it, but the code version must not change just because of duplicates.
 */
function normalizeRuntimeFingerprint(runtimeFingerprint: string): string {
	try {
		const parsed: unknown = JSON.parse(runtimeFingerprint)
		if (!Array.isArray(parsed)) return runtimeFingerprint
		const seen = new Set<string>()
		const unique = parsed.filter((item) => {
			const fileId =
				item && typeof item === "object"
					? String((item as { fileId?: unknown }).fileId)
					: ""
			if (!fileId || seen.has(fileId)) return !fileId
			seen.add(fileId)
			return true
		})
		return JSON.stringify(unique)
	} catch {
		return runtimeFingerprint
	}
}
