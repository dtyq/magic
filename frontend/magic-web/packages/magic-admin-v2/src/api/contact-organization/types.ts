export type ContactTokenPage<TItem> = {
  items?: TItem[];
  list?: TItem[];
  data?: TItem[];
  has_more?: boolean;
  page_token?: string;
  next_page_token?: string;
};

export type ContactDepartment = {
  id?: string;
  department_id?: string;
  parent_department_id?: string;
  name?: string;
  i18n_name?: string;
  employee_sum?: number;
  user_count?: number;
  member_count?: number;
  children_count?: number;
  has_child?: boolean;
  have_children?: boolean;
  level?: number;
};

export type ContactUser = {
  id?: string;
  user_id?: string;
  nickname?: string;
  name?: string;
  real_name?: string;
  user_name?: string;
  avatar_url?: string;
  avatar?: string;
  email?: string;
  phone?: string;
  job_title?: string;
  position?: string;
  work_number?: string;
  departments?: Array<string | { name?: string }>;
  path_nodes?: Array<{
    department_id?: string;
    department_name?: string;
    name?: string;
    parent_department_id?: string;
    path?: string;
    visible?: boolean;
  }>;
};

export type ContactDepartmentChildrenParams = {
  departmentId?: string;
  pageToken?: string;
  sumType?: 1 | 2;
};

export type ContactDepartmentUsersParams = {
  count?: number;
  departmentId?: string;
  isRecursive?: 0 | 1;
  pageToken?: string;
};

export type ContactUserSearchParams = {
  pageToken?: string;
  query: string;
  queryType?: 1 | 2;
};
