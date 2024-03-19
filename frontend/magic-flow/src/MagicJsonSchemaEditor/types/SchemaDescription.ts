import _ from 'lodash';
import { makeAutoObservable } from 'mobx';
import { AppendPosition, JSONPATH_JOIN_CHAR, SchemaValueSplitor } from '../constants';
import {
  addRequiredFields,
  commonDefaultSchema,
  getDefaultSchema,
  getParentKey,
  handleSchema,
  handleSchemaRequired,
} from '../utils/SchemaUtils';
import Open from './Open';
import Schema from './Schema';
import { FormItemType, InputExpressionValue, VALUE_TYPE } from '@/MagicExpressionWidget/types';

export default class SchemaDescription {
  schema: Schema;

  open: Open;

  fieldNum: number;

  constructor(schema?: Schema) {
    if (schema) {
      if (schema.type === 'object' && !schema.properties) {
        schema.properties = {};
      }
      this.schema = schema;
    } else {
      this.schema = {
        ...commonDefaultSchema,
        type: 'object',
        properties: {},
        required: [],
      };
    }
    this.open = { properties: true };
    this.fieldNum = 1;
    // console.log(JSON.parse(JSON.stringify(this)))
    makeAutoObservable(this);
  }

  changeSchema(value: Schema): void {
    // console.error('change schema', value);
    this.schema = handleSchema(value);
  }

  addChildField({
    keys,
    customFieldName,
  }: {
    keys: string[];
    /** 自定义field的name */
    customFieldName?: string;
  }): void {
    let fieldName = '';
    let clonedSchema = _.clone(this.schema);
    const currentField = _.get(clonedSchema, keys, {});

	const parentKeys = keys.slice(0, -1)
	let parentField = _.get(clonedSchema, parentKeys)
	if(parentKeys.length == 0) parentField = clonedSchema
	//  处理数组添加字成员情况
	if(parentField?.type === FormItemType.Array) {
		fieldName = `${Object.keys(currentField || {}).length}`
		clonedSchema = _.update(clonedSchema, keys, (n) =>
			_.assign(n, {
				[fieldName]: _.cloneDeep(parentField.items),
			}),
		);
	}else {
		if (customFieldName) {
			fieldName = customFieldName;
		} else {
			fieldName = `field_${this.fieldNum++}`;
			while (typeof currentField?.[fieldName] !== 'undefined') {
				fieldName = `field_${this.fieldNum++}`;
			}
		}
		if (currentField !== undefined) {
			clonedSchema = _.update(clonedSchema, keys, (n) =>
				_.assign(n, {
				[fieldName]: getDefaultSchema('string'),
				}),
			);
		}
	}

    this.schema = clonedSchema;
    // this.schema = addRequiredFields(clonedSchema, keys, fieldName);
  }

  deleteField({ keys }: { keys: string[] }): void {
    const clonedSchema = _.clone(this.schema);
    _.unset(clonedSchema, keys);
    this.schema = clonedSchema;
  }

  addField({
    keys,
    name,
    position,
  }: {
    keys: string[];
    name?: string;
    position: AppendPosition;
  }): void {
    const clonedSchema = _.clone(this.schema);
    const propertiesData = _.get(this.schema, keys);
    
    // 获取父级字段类型
    const parentKeys = getParentKey(keys);
    const parentField = parentKeys.length
      ? _.get(this.schema, parentKeys)
      : this.schema;
    
    // 根据父级类型确定fieldName
    let fieldName: string;
    if (parentField?.type === FormItemType.Array) {
      // 如果父级是数组，fieldName为数字索引
      fieldName = `${Object.keys(propertiesData || {}).length}`;
    } else {
      // 非数组类型，使用原有的命名逻辑
      fieldName = `field_${this.fieldNum++}`;
      while (typeof propertiesData[fieldName] !== 'undefined') {
        fieldName = `field_${this.fieldNum++}`;
      }
    }
    
    // 根据父级字段类型判断添加什么类型的字段
    let fieldType = 'string'; // 默认为字符串类型
    if (parentField?.type === FormItemType.Array) {
      // 如果父级是数组，则添加的字段类型与数组项类型一致
      const itemsType = parentField.items?.type;
      if (itemsType) {
        fieldType = itemsType;
      }
    }
    
    let newPropertiesData: Record<string, Schema> = {};
    if (name) {
      // eslint-disable-next-line guard-for-in
      for (const i in propertiesData) {
        newPropertiesData[i] = propertiesData[i];
        if (i === name) {
          newPropertiesData[fieldName] = getDefaultSchema(fieldType);
        }
      }
    } else {
      newPropertiesData = _.assign(propertiesData, {
        [fieldName]: getDefaultSchema(fieldType),
      });
    }
    // 默认是添加到下一个节点
    let newSchema = _.update(clonedSchema, keys, () => newPropertiesData);
    // 如果指定添加到尾部时的处理路径
    if (position === AppendPosition.Tail) {
      newSchema = _.update(clonedSchema, keys, (n) =>
        _.assign(n, newPropertiesData),
      );
    }
    // this.schema = addRequiredFields(newSchema, keys, fieldName);
    this.schema = newSchema;
  }

  changeType({ keys, value, itemsType }: { keys: string[]; value: string; itemsType?: string }): void {
    // 获取父级字段
    const parentKeys = getParentKey(keys);
    const parentField = parentKeys.length
      ? _.get(this.schema, parentKeys)
      : this.schema;

    const isSameItemsType = itemsType === parentField?.items?.type
    if (parentField.type === value && isSameItemsType) {
      return;
    }
    const clonedSchema = _.clone(this.schema);
    const extendsProps = _.pick(parentField, ['description', 'title'])

    const newParentDataItem: Schema = {
      ...getDefaultSchema(value, itemsType),
      ...extendsProps,
    };
    if (parentKeys.length === 0) {
      this.schema = { ...newParentDataItem };
    } else {
       _.set(clonedSchema, parentKeys, newParentDataItem);
       this.schema = {...this.schema}
    }
  }

  insertFields({
    keys,
    name,
    position,
    fields // 导入时才需要传的内容
  }: {
    keys: string[];
    name?: string;
    position: AppendPosition;
    fields?: Schema
  }): void {
    if(!fields) return
    const cloneFields = _.cloneDeep(fields)
    const clonedSchema = _.clone(this.schema);
    const propertiesData = _.get(this.schema, keys);
    let newPropertiesData: Record<string, Schema> = {};

    if (name) {
      // eslint-disable-next-line guard-for-in
      for (const i in propertiesData) {
        newPropertiesData[i] = propertiesData[i];
        if (i === name) {
          // 导入所有属性
          Object.entries(cloneFields?.properties || {}).forEach(([key, schema]) => {
            newPropertiesData[key] = schema;
          });
        }
      }
    } else {
      // 直接导入所有属性
      newPropertiesData = _.assign(propertiesData, {
        ...cloneFields.properties
      });
    }
    
    // 默认是添加到下一个节点
    let newSchema = _.update(clonedSchema, keys, () => newPropertiesData);
    // 如果指定添加到尾部时的处理路径
    if (position === AppendPosition.Tail) {
      newSchema = _.update(clonedSchema, keys, (n) =>
        _.assign(n, newPropertiesData),
      );
    }
    this.schema = newSchema
  }

  enableRequire({
    keys,
    name,
    required,
  }: {
    keys: string[];
    name: string;
    required: boolean;
  }): void {
    const parentKeys: string[] = getParentKey(keys);
    const parentData = parentKeys.length
      ? _.get(this.schema, parentKeys)
      : this.schema;
    const requiredArray: string[] = [].concat(parentData.required || []);
    const requiredFieldIndex = requiredArray.indexOf(name);
    const foundRequired = requiredFieldIndex >= 0;
    if (!required && foundRequired) {
      // Remove from required arr
      requiredArray.splice(requiredFieldIndex, 1);
    } else if (required && !foundRequired) {
      // Add to required arr
      requiredArray.push(name);
    }
    parentKeys.push('required');
    const clonedSchema = _.clone(this.schema);
    this.schema = _.set(clonedSchema, parentKeys, requiredArray);
  }

  changeName({
    keys,
    name,
    value,
  }: {
    keys: string[];
    name: string;
    value: string;
  }): void {
    // 获取父级字段
    const parentKeys = getParentKey(keys);
    const parentField = parentKeys.length
      ? _.get(this.schema, parentKeys)
      : this.schema;

    let clonedSchema = _.clone(this.schema);
    let requiredData = [].concat(parentField.required || []);
    const propertiesData = _.get(clonedSchema, keys);
    const newPropertiesData = {};

    const curData = propertiesData[name];
    const openKeys = [...keys]
      .concat(value, 'properties')
      .join(JSONPATH_JOIN_CHAR);
    const oldOpenKeys = [...keys]
      .concat(name, 'properties')
      .join(JSONPATH_JOIN_CHAR);
    if (curData.properties) {
      // @ts-ignore
      delete this.open[oldOpenKeys];
      // @ts-ignore
      this.open[openKeys] = true;
    }
    if (propertiesData[value] && typeof propertiesData[value] === 'object') {
      return;
    }
    // @ts-ignore
    requiredData = requiredData.map((item) => {
      if (item === name) return value;
      return item;
    });

    parentKeys.push('required');

    clonedSchema = _.set(clonedSchema, parentKeys, requiredData);
    for (const i in propertiesData) {
      if (i === name) {
        // @ts-ignore
        newPropertiesData[value] = propertiesData[i];
      } else {
        // @ts-ignore
        newPropertiesData[i] = propertiesData[i];
      }
    }
    this.schema = _.set(clonedSchema, keys, newPropertiesData);
  }

  changeValue({
    keys,
    value,
  }: {
    keys: string[];
    value: string | boolean | { mock: string } | InputExpressionValue;
  }): void {
	const newSchema = _.clone(this.schema);
	if (value) {
		_.set(newSchema, keys, value);
		this.schema = { ...newSchema };
	} else {
		this.deleteField({ keys });
	}
  }

  requireAll({ required }: { required: boolean }): void {
    const newSchema = _.clone(this.schema);
    this.schema = handleSchemaRequired(newSchema, required);
  }

  setOpenValue({ key, value }: { key: string[]; value?: boolean }): void {
    const clonedState = _.clone(this.open);
    const keys = key.join(JSONPATH_JOIN_CHAR);
    const status = value === undefined ? !_.get(this.open, [keys]) : value;
    this.open = _.set(clonedState, [keys], status);
  }
}
