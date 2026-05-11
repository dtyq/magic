import type {
	DataService,
	MentionPanelCatalogBehavior,
	MentionPanelCatalogHeaderMeta,
	MentionPanelProps,
	MentionPanelRuntime,
	MentionStoreRequestBuildOptions,
} from "../types"
import type { I18nTexts } from "../i18n/types"
import type { MentionStoreRequest } from "../dispatch"
import builtinMentionPanelStore from "./builtin/store"
import { defaultMentionPanelCatalogBehavior } from "./builtin/catalog-behavior"
import { buildMentionStoreRequest } from "./builtin/request-builder"
import { getBuiltinMentionItemRenderer } from "./builtin/renderer"
import { getCatalogHeaderMeta } from "./builtin/catalog-metadata"

interface ResolvedMentionPanelRuntime<TCatalogId extends string = string> extends Required<
	Pick<
		MentionPanelRuntime<TCatalogId>,
		| "buildStoreRequest"
		| "catalogBehavior"
		| "dataService"
		| "getCatalogHeaderMeta"
		| "getItemRenderer"
	>
> {}

export const defaultMentionPanelRuntime: MentionPanelRuntime<string> = {
	dataService: builtinMentionPanelStore as DataService,
	catalogBehavior: defaultMentionPanelCatalogBehavior,
	buildStoreRequest: buildMentionStoreRequest,
	getItemRenderer: getBuiltinMentionItemRenderer,
	getCatalogHeaderMeta: (catalogId, t) => getCatalogHeaderMeta(catalogId as never, t),
}

export function resolveMentionPanelRuntime<TCatalogId extends string = string>(
	props: Pick<
		MentionPanelProps<TCatalogId>,
		"buildStoreRequest" | "catalogBehavior" | "dataService" | "runtime"
	>,
): ResolvedMentionPanelRuntime<TCatalogId> {
	const builtinRuntime = defaultMentionPanelRuntime as unknown as MentionPanelRuntime<TCatalogId>
	const injectedRuntime = props.runtime

	return {
		dataService:
			injectedRuntime?.dataService ??
			props.dataService ??
			builtinRuntime.dataService ??
			nullDataService,
		catalogBehavior:
			injectedRuntime?.catalogBehavior ??
			props.catalogBehavior ??
			builtinRuntime.catalogBehavior ??
			(nullCatalogBehavior as unknown as MentionPanelCatalogBehavior<TCatalogId>),
		buildStoreRequest:
			injectedRuntime?.buildStoreRequest ??
			props.buildStoreRequest ??
			builtinRuntime.buildStoreRequest ??
			nullBuildStoreRequest,
		getItemRenderer:
			injectedRuntime?.getItemRenderer ?? builtinRuntime.getItemRenderer ?? (() => ({})),
		getCatalogHeaderMeta:
			injectedRuntime?.getCatalogHeaderMeta ??
			builtinRuntime.getCatalogHeaderMeta ??
			getNullCatalogHeaderMeta,
	}
}

function nullBuildStoreRequest<TCatalogId extends string = string>(
	options: MentionStoreRequestBuildOptions<TCatalogId>,
): MentionStoreRequest | null {
	void options

	return null
}

const nullCatalogBehavior: MentionPanelCatalogBehavior<string> = {}

function getNullCatalogHeaderMeta(
	catalogId: string | undefined,
	t: I18nTexts,
): MentionPanelCatalogHeaderMeta {
	void catalogId
	void t

	return {
		hint: null,
		icon: null,
	}
}

const nullDataService: DataService = {
	dispatch: () => ({
		items: [],
	}),
}
