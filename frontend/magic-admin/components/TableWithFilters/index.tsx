import type { TableWithFiltersProps } from "./TableWithFilters"
import TableWithFilters from "./TableWithFilters"
import type {
	SearchItem,
	TextSearchItem,
	SelectSearchItem,
	DateRangeSearchItem,
	DateSearchItem,
	CustomSearchItem,
	TableButton,
} from "./types"
import { SearchItemType } from "./types"
import { SearchForm } from "./SearchForm"
import type { SearchFormProps } from "./SearchForm"
import {
	SearchComponentProvider,
	useSearchComponents,
	useRegisterSearchComponent,
} from "./SearchComponentRegistry"

export type {
	TableWithFiltersProps,
	SearchItem,
	SearchFormProps,
	TextSearchItem,
	SelectSearchItem,
	DateRangeSearchItem,
	DateSearchItem,
	CustomSearchItem,
	TableButton,
}
export default TableWithFilters
export {
	SearchForm,
	SearchComponentProvider,
	useSearchComponents,
	useRegisterSearchComponent,
	SearchItemType,
}
