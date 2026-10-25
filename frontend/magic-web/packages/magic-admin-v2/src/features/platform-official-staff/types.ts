export const officialStaffStatus = {
  disabled: 0,
  enabled: 1,
} as const;

export const staffDistributionType = {
  independent: 1,
  follow: 2,
} as const;

export const staffIconType = {
  icon: 1,
  image: 2,
} as const;

export const staffModelStatus = {
  normal: "normal",
  deleted: "deleted",
  disabled: "disabled",
} as const;

export const staffModelType = {
  dynamic: "dynamic",
} as const;

export const staffStrategyType = {
  permissionFallback: "permission_fallback",
} as const;

export const staffOrderDirection = {
  asc: "asc",
  desc: "desc",
} as const;

export type NameI18n = {
  default?: string;
  en_US?: string;
  zh_CN?: string;
};

export type OfficialStaffListParams = {
  page: number;
  page_size: number;
  status?: number | string;
  keyword?: string;
  identifier?: string;
};

export type DefaultAgentSetting = {
  default_agent_code: string;
};

export type WithPage<T> = {
  list: T[];
  total: number;
};

export type StaffDistributionType =
  (typeof staffDistributionType)[keyof typeof staffDistributionType];

export type StaffIconType = (typeof staffIconType)[keyof typeof staffIconType];

export type StaffOrderDirection =
  (typeof staffOrderDirection)[keyof typeof staffOrderDirection];

export type OfficialStaff = {
  color?: string;
  created_at?: string;
  description?: string;
  distribution_type: StaffDistributionType;
  follow_mode_id?: string;
  icon_type?: StaffIconType;
  icon?: string;
  icon_url?: string;
  id: string;
  identifier: string;
  is_default?: 1 | 0;
  name_i18n: NameI18n;
  organization_code?: string;
  organization_whitelist?: string;
  placeholder_i18n?: NameI18n;
  sort?: number | string;
  status: boolean;
  updated_at?: string;
};

export type OfficialStaffFormState = {
  identifier: string;
  name_i18n: {
    zh_CN: string;
    en_US: string;
  };
  organization_whitelist: string;
  placeholder_i18n: {
    zh_CN: string;
    en_US: string;
  };
  sort: number;
};

export type SaveOfficialStaffParams = OfficialStaffFormState & {
  description: string;
  organization_whitelist: string;
};

export type OfficialStaffGroup = {
  created_at?: string;
  description?: string;
  icon?: string;
  id: string;
  mode_id: string;
  models?: string[];
  name_i18n: NameI18n;
  sort?: number;
  status?: boolean;
};

export type SaveOfficialStaffGroupParams = {
  icon?: string;
  id?: string;
  mode_id: string;
  name_i18n: NameI18n;
};

export type StaffGroupModelStatus =
  (typeof staffModelStatus)[keyof typeof staffModelStatus];

export type StaffBaseModel = {
  group_id: string;
  id: string;
  model_category?: string;
  model_icon?: string;
  model_id: string;
  model_name: string;
  model_status: StaffGroupModelStatus;
  provider_model_id?: string;
  sort: number;
};

export type StaffDynamicModel = Omit<StaffBaseModel, "model_status"> & {
  aggregate_config: {
    models: StaffBaseModel[];
    strategy?: typeof staffStrategyType.permissionFallback;
    strategy_config?: {
      order?: StaffOrderDirection;
    };
  };
  model_description?: string;
  model_translate: {
    description?: NameI18n;
    name?: NameI18n;
  };
  model_type: typeof staffModelType.dynamic;
};

export type StaffModelItem = StaffBaseModel | StaffDynamicModel;

export const staffModelCategory = {
  text: "text",
  image: "image",
  video: "video",
} as const;

export type StaffModelCategory = (typeof staffModelCategory)[keyof typeof staffModelCategory];

export type StaffModelCategoryField = "text_models" | "image_models" | "video_models";

export type SaveOfficialStaffGroupConfig = {
  group: OfficialStaffGroup;
  /** Legacy response compatibility only; never render or submit this field. */
  models?: StaffModelItem[];
  text_models: StaffModelItem[];
  image_models: StaffModelItem[];
  video_models: StaffModelItem[];
};

export type OfficialStaffDetail = {
  groups: SaveOfficialStaffGroupConfig[];
  mode: OfficialStaff;
};

export type OfficialStaffModelOption = {
  category?: string;
  description?: string;
  icon?: string;
  id: string;
  model_id: string;
  name?: string;
  service_provider_config_id?: string;
  status?: number;
};

export type AllModelListParams = {
  category?: string;
  is_model_id_filter?: boolean;
  status?: number;
};

export type UpdateOfficialStaffStatusParams = {
  id: string;
  status: boolean;
};
