import _ from 'lodash';
// @ts-ignore
import Snowflake from 'snowflake-id';
import { SCHEMA_TYPE, SchemaOption, getSchemaToOptionsMap } from '../constants';
import Schema from '../types/Schema';
import { commonDefaultSchema } from './SchemaUtils';
import { FormItemType } from '@/MagicExpressionWidget/types';

const snowflake = new Snowflake({
  mid: 1024,
  offset: (2020 - 1970) * 31536000 * 1000,
});

export const SnowflakeId = () => {
  return snowflake.generate();
};

export function cleanAndFilterArray<FilterType>(inputArray: FilterType[]): FilterType[] {
  if (!inputArray) return [];

  const allowedTypes = SCHEMA_TYPE;
  // 过滤空字符串和非法类型的元素
  const filteredArray = _.filter(inputArray, (item) => {
    if (_.isEmpty(item)) {
      return false; // 过滤空字符串
    }
    return allowedTypes.includes(item as any);
  });

  // 使用 lodash 的 uniqWith 函数来删除重复项
  // @ts-ignore
  const uniqueArray = _.uniqWith(filteredArray, _.isEqual);

  return uniqueArray;
}

/** 生成默认的根节点 */
export const genRootField = (
  oneChildAtLeast: boolean,
  firstChildKey: string,
) => {
  let defaultSchema = {
    ...commonDefaultSchema,
    type: 'object',
    properties: {} as Record<string, Schema>,
    required: [] as string[],
  };

  if (oneChildAtLeast) {
    defaultSchema.properties[firstChildKey] = {
      type: 'string',
      ...commonDefaultSchema,
    };
    defaultSchema.required.push(firstChildKey);
  }
  return defaultSchema;
};


// 获取当前schema枚举可选的下拉数据源
export const getSelectOptions = (schemaTypes: FormItemType[]) => {
    return schemaTypes.reduce((acc, curSchemaType) => {
        const schemaTypeOptions = _.get(getSchemaToOptionsMap(), [curSchemaType], [])
        acc.push(...schemaTypeOptions)
        return acc
    }, [] as SchemaOption[])
}

/** 不关注值字段的导出 */
export const unFocusSchemaValue = (schema: Schema) => {
	//@ts-ignore
	if(schema.value) schema.value = null
	if(schema.properties) {
		Object.values(schema.properties).forEach((subSchema) => {
			unFocusSchemaValue(subSchema)
		})
	}
}