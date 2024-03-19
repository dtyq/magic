import _ from 'lodash';
import Schema from '../types/Schema';

// 默认都有的schema
export const commonDefaultSchema = {
  title: '',
  description: '',
  value: null as any,
  encryption: false
};

export function getDefaultSchema(type: string, itemsType?: string): Schema {
  switch (type) {
    case 'string':
      return {
        type: 'string',
        ...commonDefaultSchema,
      };
    case 'number':
      return {
        type: 'number',
        ...commonDefaultSchema,
      };
    case 'array':
      return {
        type: 'array',
        items: {
          type: itemsType || 'string',
          ...commonDefaultSchema,
        },
        properties: {},
        ...commonDefaultSchema,
      };
    case 'object':
      return {
        type: 'object',
        properties: {},
        required: [],
        ...commonDefaultSchema,
      };
    case 'boolean':
      return {
        type: 'boolean',
        ...commonDefaultSchema,
      };
    case 'integer':
      return {
        type: 'integer',
        ...commonDefaultSchema,
      };
    default:
      throw new Error(`Unsupported type: ${type}`);
  }
}

export const handleSchema = (schema: Schema): Schema => {
  const clonedSchema = _.cloneDeep(schema);
  if (clonedSchema && !clonedSchema.type && !clonedSchema.properties) {
    clonedSchema.type = 'string';
  }
  if (
    !clonedSchema.type &&
    clonedSchema.properties &&
    typeof clonedSchema.properties === 'object'
  ) {
    clonedSchema.type = 'object';
  }
  if (clonedSchema.type === 'object') {
    if (!clonedSchema.properties) {
      clonedSchema.properties = {};
    }
    Object.keys(clonedSchema.properties).forEach((key) => {
      if (
        // @ts-ignore
        !clonedSchema.properties[key].type &&
        // @ts-ignore
        clonedSchema.properties[key].properties &&
        // @ts-ignore
        typeof clonedSchema.properties[key].properties === 'object'
      ) {
        // @ts-ignore
        clonedSchema.properties[key].type = 'object';
      }
      if (
        // @ts-ignore
        clonedSchema.properties[key].type === 'array' ||
        // @ts-ignore
        clonedSchema.properties[key].type === 'object'
      ) {
        // @ts-ignore
        clonedSchema.properties[key] = handleSchema(
          // @ts-ignore
          clonedSchema.properties[key],
        );
      }
    });
  } else if (clonedSchema.type === 'array') {
    if (!clonedSchema.items) {
      clonedSchema.items = { type: 'string', ...commonDefaultSchema };
    }
    clonedSchema.items = handleSchema(clonedSchema.items);
  }
  return clonedSchema;
};

export const getParentKey = (keys: string[]): string[] => {
  if (!keys) {
    return [];
  }
  return keys.length === 1 ? [] : _.dropRight(keys, 1);
};

export const addRequiredFields = (
  schema: Schema,
  keys: string[],
  fieldName: string,
): Schema => {
  const parentKeys: string[] = getParentKey(keys); // parent
  const parentData = parentKeys.length ? _.get(schema, parentKeys) : schema;
  const requiredData: string[] = [].concat(parentData.required || []);
  requiredData.push(fieldName);
  parentKeys.push('required');
  // @ts-ignore
  return _.set(schema, parentKeys, _.uniq(requiredData));
};

export const removeRequireField = (
  schema: Schema,
  keys: string[],
  fieldName: string,
): Schema => {
  const parentKeys: string[] = getParentKey(keys); // parent
  const parentData = parentKeys.length ? _.get(schema, parentKeys) : schema;
  const requiredData = [].concat(parentData.required || []);
  const filteredRequire = requiredData.filter((i) => i !== fieldName);
  parentKeys.push('required');
  // @ts-ignore
  return _.set(schema, parentKeys, _.uniq(filteredRequire));
};

export const handleSchemaRequired = (
  schema: Schema,
  checked: boolean,
): Schema => {
  const newSchema = _.cloneDeep(schema);
  if (newSchema.type === 'object') {
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const requiredTitle = getFieldsTitle(newSchema.properties);
    if (checked) {
      newSchema.required = requiredTitle;
    } else {
      delete newSchema.required;
    }
    if (newSchema.properties) {
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      newSchema.properties = handleObject(newSchema.properties, checked);
    }
  } else if (newSchema.type === 'array') {
    if (newSchema.items) {
      newSchema.items = handleSchemaRequired(newSchema.items, checked);
    }
  }
  return newSchema;
};

function handleObject(properties: Record<string, Schema>, checked: boolean) {
  const clonedProperties = _.cloneDeep(properties);
  for (const key in clonedProperties) {
    if (
      clonedProperties[key].type === 'array' ||
      clonedProperties[key].type === 'object'
    )
      clonedProperties[key] = handleSchemaRequired(
        clonedProperties[key],
        checked,
      );
  }
  return clonedProperties;
}

function getFieldsTitle(data: Record<string, Schema>): string[] {
  const requiredTitle: string[] = [];
  Object.keys(data).forEach((title) => {
    requiredTitle.push(title);
  });
  return requiredTitle;
}

/**
 * 生成唯一ID
 */
export const generateUniqueId = (): string => {
    return Math.floor(Math.random() * 1000000000000000000).toString();
};

/**
 * 将普通值转换为表达式组件值
 * @param value 普通值
 * @returns 符合InputExpressionValue类型的表达式组件值
 */
export const convertToExpressionValue = (value: any): any => {
    // 处理undefined和null
    if (value === undefined || value === null) {
        return null;
    }

    // 将值转换为字符串
    const stringValue = String(value);

    return {
        type: "const",
        const_value: [
            {
                type: "input",
                uniqueId: generateUniqueId(),
                value: stringValue
            }
        ],
        expression_value: []
    };
};

// 将普通JSON转换为Schema格式
export const convertJsonToSchema = (json: any): Schema => {
    if (json === null) {
        return getDefaultSchema("string")
    }

    if (Array.isArray(json)) {
        // 处理数组
        const arraySchema = getDefaultSchema("array")

        if (json.length > 0) {
            // 根据第一个元素类型确定items类型
            const firstItem = json[0]
            const itemType = typeof firstItem

            if (typeof firstItem === "object" && firstItem !== null) {
                if (Array.isArray(firstItem)) {
                    arraySchema.items = getDefaultSchema("array")
                } else {
                    arraySchema.items = convertJsonToSchema(firstItem)
                }
            } else {
                arraySchema.items = getDefaultSchema(itemType)
            }
            
            // 为数组的每个元素创建对应的属性
            arraySchema.properties = {}
            json.forEach((item, index) => {
                if (typeof item === "object" && item !== null) {
                    arraySchema.properties![index.toString()] = convertJsonToSchema(item)
                } else {
                    const schema = getDefaultSchema(typeof item)
                    schema.value = convertToExpressionValue(item)
                    arraySchema.properties![index.toString()] = schema
                }
            })
        }

        return arraySchema
    }

    if (typeof json === "object") {
        // 处理对象
        const objectSchema = getDefaultSchema("object")
        objectSchema.properties = {}

        Object.keys(json).forEach((key) => {
            objectSchema.properties![key] = convertJsonToSchema(json[key])
        })

        return objectSchema
    }

    // 处理基本类型
    const type = typeof json
    const schema = getDefaultSchema(type)
    schema.value = convertToExpressionValue(json)
    return schema
}

// 判断是否为Schema格式
export const isSchemaFormat = (json: any): boolean => {
    // 简单判断是否包含Schema的关键属性
    return (
        json &&
        typeof json === "object" &&
        "type" in json &&
        (json.properties !== undefined || json.items !== undefined)
    )
}

/**
 * 判断字段是否可以编辑（更改类型或名称）
 * @param parentField 父级字段对象
 * @returns 是否可编辑
 */
export const canEditField = (parentField: Schema | null): boolean => {
    
  // 如果父级是数组类型且已定义items，则不允许编辑
  if (parentField && parentField.type === 'array' && parentField.items) {
    return false;
  }
  
  // 其他情况下都可以编辑
  return true;
};
