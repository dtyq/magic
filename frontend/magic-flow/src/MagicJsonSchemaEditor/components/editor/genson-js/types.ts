import { FormItemType } from "@/MagicExpressionWidget/types";

// copy from https://github.com/aspecto-io/genson-js
// export enum FormItemType {
//   Null = 'null',
//   Boolean = 'boolean',
//   Integer = 'integer',
//   Number = 'number',
//   String = 'string',
//   Object = 'object',
//   Array = 'array',
// }

export type Schema = {
  type?: FormItemType;
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  anyOf?: Array<Schema>;
};

export type SchemaGenOptions = {
  noRequired: boolean;
};

export type SchemaComparisonOptions = {
  ignoreRequired: boolean;
};
