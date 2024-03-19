/* eslint-disable @typescript-eslint/no-unused-vars,@typescript-eslint/no-use-before-define */
// copy from https://github.com/aspecto-io/genson-js
import { FormItemType } from '@/MagicExpressionWidget/types';
import { Schema, SchemaGenOptions } from './types';

// eslint-disable-next-line
function createSchemaFor(value: any, options?: SchemaGenOptions): Schema {
  switch (typeof value) {
    case 'number':
      if (Number.isInteger(value)) {
        return { type: FormItemType.Integer };
      }
      return { type: FormItemType.Number };
    case 'boolean':
      return { type: FormItemType.Boolean };
    case 'string':
      return { type: FormItemType.String };
    case 'object':
    //   if (value === null) {
    //     return { type: FormItemType.Null };
    //   }
      if (Array.isArray(value)) {
        return createSchemaForArray(value, options);
      }
      return createSchemaForObject(value, options);
    default:
      throw new Error('unknown type');
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createSchemaForArray(
  arr: Array<any>,
  options?: SchemaGenOptions,
): Schema {
  if (arr.length === 0) {
    return { type: FormItemType.Array };
  }
  const elementSchemas = arr.map((value) => createSchemaFor(value, options));
  const items = combineSchemas(elementSchemas);
  return { type: FormItemType.Array, items };
}

function createSchemaForObject(
  obj: object,
  options?: SchemaGenOptions,
): Schema {
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return {
      type: FormItemType.Object,
    };
  }
  const properties = Object.entries(obj).reduce((props: any, [key, val]) => {
    props[key] = createSchemaFor(val, options);
    return props;
  }, {});

  const schema: Schema = { type: FormItemType.Object, properties };
  if (!options?.noRequired) {
    schema.required = keys;
  }
  return schema;
}

function combineSchemas(schemas: Schema[], options?: SchemaGenOptions): Schema {
  const schemasByType: Record<FormItemType, Schema[]> = {
    // [FormItemType.Null]: [],
    [FormItemType.Boolean]: [],
    [FormItemType.Integer]: [],
    [FormItemType.Number]: [],
    [FormItemType.String]: [],
    [FormItemType.Array]: [],
    [FormItemType.Object]: [],
  };

  const unwrappedSchemas = unwrapSchemas(schemas);
  for (const unwrappedSchema of unwrappedSchemas) {
    const type = unwrappedSchema.type as FormItemType;
    if (
      schemasByType[type].length === 0 ||
      isContainerSchema(unwrappedSchema)
    ) {
      schemasByType[type].push(unwrappedSchema);
    } else {
    }
  }

  const resultSchemasByType: Record<FormItemType, Schema> = {
    // [FormItemType.Null]: schemasByType[FormItemType.Null][0],
    [FormItemType.Boolean]: schemasByType[FormItemType.Boolean][0],
    [FormItemType.Number]: schemasByType[FormItemType.Number][0],
    [FormItemType.Integer]: schemasByType[FormItemType.Integer][0],
    [FormItemType.String]: schemasByType[FormItemType.String][0],
    [FormItemType.Array]: combineArraySchemas(schemasByType[FormItemType.Array]),
    [FormItemType.Object]: combineObjectSchemas(
      schemasByType[FormItemType.Object],
      options,
    ),
  };

  if (resultSchemasByType[FormItemType.Number]) {
    // if at least one value is float, others can be floats too
    // @ts-ignore
    delete resultSchemasByType[FormItemType.Integer];
  }

  const schemasFound = Object.values(resultSchemasByType).filter(Boolean);
  const multiType = schemasFound.length > 1;
  if (multiType) {
    return wrapAnyOfSchema({ anyOf: schemasFound });
  }
  return schemasFound[0] as Schema;
}

function combineArraySchemas(schemas: Schema[]): Schema {
  if (!schemas || schemas.length === 0) {
    // @ts-ignore
    return undefined;
  }
  const itemSchemas: Schema[] = [];
  for (const schema of schemas) {
    if (!schema.items) continue;
    const unwrappedSchemas = unwrapSchema(schema.items);
    itemSchemas.push(...unwrappedSchemas);
  }

  if (itemSchemas.length === 0) {
    return {
      type: FormItemType.Array,
    };
  }
  const items = combineSchemas(itemSchemas);
  return {
    type: FormItemType.Array,
    items,
  };
}

function combineObjectSchemas(
  schemas: Schema[],
  options?: SchemaGenOptions,
): Schema {
  if (!schemas || schemas.length === 0) {
    // @ts-ignore
    return undefined;
  }
  const allPropSchemas = schemas.map((s) => s.properties).filter(Boolean);
  const schemasByProp: Record<string, Schema[]> = Object.create(null);
  // const schemasByProp: Record<string, Schema[]> = {};
  for (const propSchemas of allPropSchemas) {
    // @ts-ignore
    for (const [prop, schema] of Object.entries(propSchemas)) {
      if (!schemasByProp[prop]) {
        schemasByProp[prop] = [];
      }
      const unwrappedSchemas = unwrapSchema(schema);
      schemasByProp[prop].push(...unwrappedSchemas);
    }
  }

  const properties: Record<string, Schema> = Object.entries(
    schemasByProp,
  ).reduce((props, [prop, schemas]) => {
    if (schemas.length === 1) {
      // @ts-ignore
      props[prop] = schemas[0];
    } else {
      // @ts-ignore
      props[prop] = combineSchemas(schemas);
    }
    return props;
  }, {});

  const combinedSchema: Schema = { type: FormItemType.Object };

  if (Object.keys(properties).length > 0) {
    combinedSchema.properties = properties;
  }
  if (!options?.noRequired) {
    const required = intersection(schemas.map((s) => s.required || []));
    if (required.length > 0) {
      combinedSchema.required = required;
    }
  }

  return combinedSchema;
}

export function unwrapSchema(schema: Schema): Schema[] {
  if (!schema) return [];
  if (schema.anyOf) {
    return unwrapSchemas(schema.anyOf);
  }
  if (Array.isArray(schema.type)) {
    return schema.type.map((x) => ({ type: x }));
  }
  return [schema];
}

export function unwrapSchemas(schemas: Schema[]): Schema[] {
  if (!schemas || schemas.length === 0) return [];
  return schemas.flatMap((schema) => unwrapSchema(schema));
}

export function wrapAnyOfSchema(schema: Schema): Schema {
  const simpleSchemas = [];
  const complexSchemas = [];
  // @ts-ignore
  for (const subSchema of schema.anyOf) {
    if (Array.isArray(subSchema.type)) {
      simpleSchemas.push(...subSchema.type);
    } else if (isSimpleSchema(subSchema)) {
      simpleSchemas.push((subSchema as Schema).type);
    } else {
      complexSchemas.push(subSchema);
    }
  }
  if (complexSchemas.length === 0) {
    // @ts-ignore
    return { type: simpleSchemas };
  }
  const anyOf = [];
  if (simpleSchemas.length > 0) {
    anyOf.push({
      type: simpleSchemas.length > 1 ? simpleSchemas : simpleSchemas[0],
    });
  }
  anyOf.push(...complexSchemas);
  // @ts-ignore
  return { anyOf };
}

function intersection(valuesArr: string[][]) {
  if (valuesArr.length === 0) return [];
  const arrays = valuesArr.filter(Array.isArray);
  const counter: Record<string, number> = {};
  for (const arr of arrays) {
    for (const val of arr) {
      if (!counter[val]) {
        counter[val] = 1;
      } else {
        counter[val]++;
      }
    }
  }
  return Object.entries(counter)
    .filter(([_, value]) => value === arrays.length)
    .map(([key]) => key);
}

function isSimpleSchema(schema: Schema): boolean {
  const keys = Object.keys(schema);
  return keys.length === 1 && keys[0] === 'type';
}

function isContainerSchema(schema: Schema): boolean {
  const type = (schema as Schema).type;
  return type === FormItemType.Array || type === FormItemType.Object;
}

// FACADE

export function createSchema(
  value: unknown,
  options?: SchemaGenOptions,
): Schema {
  // @ts-ignore
  // eslint-disable-next-line no-param-reassign
  if (typeof value === 'undefined') value = null;
  const clone = JSON.parse(JSON.stringify(value));
  return createSchemaFor(clone, options);
}

export function mergeSchemas(
  schemas: Schema[],
  options?: SchemaGenOptions,
): Schema {
  return combineSchemas(schemas, options);
}

export function extendSchema(
  schema: Schema,
  value: unknown,
  options?: SchemaGenOptions,
): Schema {
  const valueSchema = createSchema(value, options);
  return combineSchemas([schema, valueSchema], options);
}

export function createCompoundSchema(
  values: unknown[],
  options?: SchemaGenOptions,
): Schema {
  const schemas = values.map((value) => createSchema(value, options));
  return mergeSchemas(schemas, options);
}
