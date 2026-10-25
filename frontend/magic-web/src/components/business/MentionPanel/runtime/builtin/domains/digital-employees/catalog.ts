import { MentionPanelCatalogId } from "../../catalog-ids"
import type { MentionPanelCatalogPlugin } from "../../registry-types"

export const digitalEmployeesCatalogPlugin: MentionPanelCatalogPlugin = {
	catalogId: MentionPanelCatalogId.DIGITAL_EMPLOYEES,
	resolveCatalog: ({ store }) => store.digitalEmployeesStore.fetchItems(),
}
