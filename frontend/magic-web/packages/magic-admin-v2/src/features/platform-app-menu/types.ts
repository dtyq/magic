export const appMenuIconType = {
  icon: 1,
  image: 2,
} as const;

export type AppMenuIconType = (typeof appMenuIconType)[keyof typeof appMenuIconType];

export const appMenuOpenMethod = {
  self: 1,
  blank: 2,
} as const;

export type AppMenuOpenMethod = (typeof appMenuOpenMethod)[keyof typeof appMenuOpenMethod];

export const appMenuDisplayScope = {
  organization: 0,
  personal: 1,
  all: 2,
} as const;

export type AppMenuDisplayScope =
  (typeof appMenuDisplayScope)[keyof typeof appMenuDisplayScope];

export const appMenuStatus = {
  enabled: 1,
  disabled: 2,
} as const;

export type AppMenuStatus = (typeof appMenuStatus)[keyof typeof appMenuStatus];

export type AppMenuLocalizedText = {
  zh_CN?: string;
  en_US?: string;
  [key: string]: string | undefined;
};

export type AppMenuItem = {
  id: string;
  name_i18n?: AppMenuLocalizedText;
  icon?: string;
  icon_url?: string;
  icon_type: AppMenuIconType;
  path: string;
  open_method: AppMenuOpenMethod;
  sort_order: number;
  display_scope: AppMenuDisplayScope;
  status: AppMenuStatus;
  can_delete?: boolean;
  creator_id?: string;
  creator_name?: string;
};

export type AppMenuListParams = {
  page: number;
  page_size: number;
  name?: string;
  status?: AppMenuStatus | null;
};

export type AppMenuPageResult = {
  list: AppMenuItem[];
  total: number;
};

export type AppMenuSaveParams = {
  id?: string;
  override_only?: boolean;
  name_i18n?: AppMenuLocalizedText;
  icon?: string;
  icon_url?: string;
  icon_type?: AppMenuIconType;
  path?: string;
  open_method?: AppMenuOpenMethod;
  sort_order?: number;
  display_scope?: AppMenuDisplayScope;
  status?: AppMenuStatus;
};

export type AppMenuFormState = {
  name_i18n: {
    zh_CN: string;
    en_US: string;
  };
  icon_type: AppMenuIconType;
  icon: string;
  icon_url: string;
  path: string;
  open_method: AppMenuOpenMethod;
  sort_order: number;
  display_scope: AppMenuDisplayScope;
  status: boolean;
};
