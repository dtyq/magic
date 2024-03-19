import { DataSourceOption } from '@/common/BaseUI/DropdownRenderer/Reference';
import { FormItemType, InputExpressionValue } from '@/MagicExpressionWidget/types';

export const enum EXPRESSION_ITEM_TYPE {
  normal = 'fields',
  input = 'input',
  func = 'methods',
}


export default interface Schema {
  // 字段的title
  title?: string;
  // 字段的类型
  type: string;
  // 字段的属性
  properties?: Record<string, Schema>;
  // 字段是否必填
  required?: string[];
  // 字段的描述
  description?: string;
  // 字段的子项
  items?: Schema;
  // 字段的值
  value: InputExpressionValue;
  // 字段是否加密
  encryption?: boolean
  // 字段加密的值
  encryption_value?: string
  // 字段的排序
  sort?: number

  // 以下为暂时用不到的字段
  default?: boolean | string;
  mock?: string | { mock: string };
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  enum?: string[] | number[];
  enumDesc?: string;
  format?: string;
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

export interface CustomOptions {
  items?: FormItemType[];
  normal?: FormItemType[];
  root?: FormItemType[];
}

/** 可被禁用的项枚举 */
export enum DisabledField {
  /** 字段名 */
  Name = 'key',
  Title = 'title',
  Description = 'description',
  Type = 'type',
  Required = 'required',
  Encryption = 'encryption',
}

/** 自定义字段配置的显示 */
export type CustomFieldsConfig = {
	onlyExpression?: boolean
	constantsDataSource?: DataSourceOption[]
	allowOperation?: boolean
	onlyConstants?: boolean
	allowAdd?: boolean
}