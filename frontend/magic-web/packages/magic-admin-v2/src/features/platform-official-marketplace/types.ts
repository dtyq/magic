import type { TimeRangeValue } from "@magic-admin-v2/components/time-filter-panel";
import type { SearchableMultiSelectOption } from "@magic-admin-v2/components/searchable-multi-select";

export const marketPageSize = 20;

export const marketDefaultPublishStatus = "PUBLISHED";

export const marketSelectAllValue = "all";

export const marketPublisherType = {
  user: "USER",
  official: "OFFICIAL",
  officialBuiltin: "OFFICIAL_BUILTIN",
} as const;

export const marketPublishStatus = {
  unpublished: "UNPUBLISHED",
  publishing: "PUBLISHING",
  published: "PUBLISHED",
  offline: "OFFLINE",
} as const;

export type MarketPublisherType =
  (typeof marketPublisherType)[keyof typeof marketPublisherType];

export type MarketPublishStatus =
  (typeof marketPublishStatus)[keyof typeof marketPublishStatus];

export type MarketOrderBy = "asc" | "desc";

export type MarketSearchField = "code" | "name_i18n" | "organization_code" | "package_name";

export type NameI18n = {
  default?: string;
  en_US?: string;
  zh_CN?: string;
};

export type RoleI18n = {
  en_US?: string | string[];
  zh_CN?: string | string[];
};

export type MarketOrganization = {
  code?: string;
  name?: string;
};

export type MarketPublisher = {
  nickname?: string;
  user_id?: string;
};

export type WithPage<T> = {
  list: T[];
  total: number;
};

export type BaseMarketListParams = {
  page: number;
  page_size: number;
  publish_status?: MarketPublishStatus | string;
  organization_code?: string;
  name_i18n?: string;
  publisher_type?: MarketPublisherType | string;
  order_by?: MarketOrderBy;
  start_time?: string;
  end_time?: string;
};

export type AgentMarketListParams = BaseMarketListParams & {
  agent_code?: string;
  category_ids?: string[];
};

export type SkillMarketListParams = BaseMarketListParams & {
  package_name?: string;
  skill_code?: string;
  category_ids?: string[];
};

export type MarketFilterDraft = {
  category_ids: string[];
  code: string;
  end_time: string;
  name_i18n: string;
  order_by: MarketOrderBy;
  organization_code: string;
  package_name: string;
  publish_status: string;
  publisher_type: string;
  search_field: MarketSearchField;
  search_value: string;
  start_time: string;
  time_range: TimeRangeValue | null;
};

export const agentMarketCategoryStatus = {
  hidden: 0,
  visible: 1,
} as const;

export type AgentMarketCategoryStatus =
  (typeof agentMarketCategoryStatus)[keyof typeof agentMarketCategoryStatus];

export type AgentMarketCategoryListParams = {
  keyword?: string;
  name_i18n?: string;
  status?: AgentMarketCategoryStatus | null;
};

export type AgentMarketCategoryOperator = {
  nickname: string;
  user_id: string;
};

export type AgentMarketCategoryItem = {
  agent_count?: number;
  created_at?: string;
  creator?: AgentMarketCategoryOperator;
  creator_id?: string | null;
  id: string;
  logo?: string | null;
  modifier?: AgentMarketCategoryOperator;
  modifier_id?: string | null;
  name_i18n?: NameI18n;
  organization_code?: string;
  sort_order?: number;
  status?: AgentMarketCategoryStatus;
  updated_at?: string;
};

export type AgentMarketCategoryListResult = {
  list: AgentMarketCategoryItem[];
};

export type SaveAgentMarketCategoryParams = {
  logo?: string | null;
  name_i18n?: NameI18n;
  sort_order?: number;
  status?: AgentMarketCategoryStatus;
};

export type AgentMarketItem = {
  agent_code: string;
  agent_version_id: string;
  categories?: AgentMarketCategoryItem[] | null;
  category?: AgentMarketCategoryItem | null;
  category_id?: string | null;
  category_ids?: string[] | null;
  created_at: string;
  description_i18n?: NameI18n;
  icon?: string | null;
  icon_type?: number;
  id: string;
  install_count?: number;
  is_featured?: boolean;
  is_hidden?: boolean;
  name_i18n?: NameI18n;
  organization?: MarketOrganization;
  organization_code: string;
  publish_status: string;
  publisher?: MarketPublisher;
  publisher_id?: string;
  publisher_type?: MarketPublisherType;
  role_i18n?: RoleI18n;
  sort_order?: number;
  updated_at: string;
};

export type SkillMarketItem = {
  category_id?: string | null;
  category_ids?: string[] | null;
  categories?: SkillMarketCategoryItem[] | null;
  created_at: string;
  description_i18n?: NameI18n;
  id: string;
  install_count?: number;
  is_featured?: boolean;
  is_hidden?: boolean;
  logo?: string | null;
  name_i18n?: NameI18n;
  organization?: MarketOrganization;
  organization_code: string;
  package_name?: string;
  publish_status: string;
  publisher?: MarketPublisher;
  publisher_id?: string;
  publisher_type?: MarketPublisherType;
  skill_code: string;
  skill_version_id: string;
  sort_order?: number;
  updated_at: string;
};

export type UpdateMarketInfoParams = {
  is_featured?: boolean;
  is_hidden?: boolean;
  sort_order?: number;
};

export type UpdateAgentMarketCategoryRelationParams = {
  category_ids: string[];
};

export type SkillMarketCategoryStatus = 0 | 1;

export type SkillMarketCategoryListParams = {
  keyword?: string;
  status?: SkillMarketCategoryStatus | null;
};

export type SkillMarketCategoryOperator = {
  nickname?: string;
  user_id?: string;
};

export type SkillMarketCategoryItem = {
  id: string;
  name?: string;
  name_i18n?: NameI18n;
  logo?: string | null;
  sort_order?: number;
  status?: SkillMarketCategoryStatus;
  skill_count?: number;
  creator?: SkillMarketCategoryOperator;
  modifier?: SkillMarketCategoryOperator;
  created_at?: string;
  updated_at?: string;
};

export type SkillMarketCategoryListResult = {
  list: SkillMarketCategoryItem[];
};

export type SaveSkillMarketCategoryParams = {
  name_i18n?: NameI18n;
  logo?: string | null;
  sort_order?: number;
  status?: SkillMarketCategoryStatus;
};

export type UpdateSkillMarketCategoryRelationParams = {
  category_ids: string[];
};

export type SkillMarketCategoryFormValues = {
  nameEn: string;
  nameZh: string;
  sortOrder: number;
  visible: boolean;
};

export type ParseOfficialSkillResponse = {
  import_token: string;
  package_name: string;
  code: string;
  package_description?: string;
  is_update?: boolean;
  version?: string;
  is_featured?: boolean;
  is_hidden?: boolean;
  sort_order?: number;
  categories?: Array<{ id: string; name?: string }>;
  name_i18n?: NameI18n;
  description_i18n?: NameI18n;
  source_i18n?: NameI18n;
  logo?: string;
};

export type OfficialSkillImportParams = {
  import_token: string;
  version: string;
  name_i18n: NameI18n;
  description_i18n: NameI18n;
  source_i18n?: NameI18n;
  logo?: string;
  category_ids?: string[];
  publish_status?: "OFFLINE" | "PUBLISHED";
  is_hidden?: boolean;
  is_featured?: boolean;
  sort_order?: number;
};

export type ImportOfficialSkillResponse = {
  code: string;
  version: string;
  action: "created" | "updated";
  market_id?: string | number | null;
  version_id?: string | number | null;
};

export type MarketKind = "employee" | "skill";

/** Values edited in the employee-market category dialog. */
export type AgentMarketCategoryFormValues = {
  nameEn: string;
  nameZh: string;
  sortOrder: number;
  visible: boolean;
};

/** Permission-derived capabilities shared by the marketplace tabs. */
export type OfficialMarketplacePermissions = {
  availableTabs: MarketKind[];
  canEditEmployee: boolean;
  canEditSkill: boolean;
  canViewEmployee: boolean;
  canViewSkill: boolean;
};

export type MarketCategoryOption = SearchableMultiSelectOption;

export type MarketDraftUpdater =
  | MarketFilterDraft
  | ((previous: MarketFilterDraft) => MarketFilterDraft);

export type MarketRecord = {
  created_at: string;
  id: string;
  install_count?: number;
  is_featured?: boolean;
  is_hidden?: boolean;
  publish_status: string;
  publisher?: { nickname?: string };
  publisher_type?: MarketPublisherType;
  sort_order?: number;
  updated_at: string;
};

export type MarketTableState<TRecord extends MarketRecord> = {
  canEdit: boolean;
  featuredSavingIds: Set<string>;
  hiddenSavingIds: Set<string>;
  saveFeatured: (record: TRecord, value: boolean) => void;
  saveHidden: (record: TRecord, value: boolean) => void;
  sortSavingIds: Set<string>;
  updateSortOrder: (record: TRecord, value: number) => void;
};
