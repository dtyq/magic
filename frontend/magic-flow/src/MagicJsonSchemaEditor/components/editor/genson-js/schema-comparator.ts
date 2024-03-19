/* eslint-disable @typescript-eslint/no-use-before-define */
// copy from https://github.com/aspecto-io/genson-js
import { unwrapSchema } from './schema-builder';
import { Schema, SchemaComparisonOptions } from './types';

export function areSchemasEqual(
  schema1: Schema,
  schema2: Schema,
  options?: SchemaComparisonOptions,
): boolean {
  if (schema1 === undefined && schema2 === undefined) return true;
  if (schema1 === undefined || schema2 === undefined) return false;

  const anyOf1 = unwrapSchema(schema1);
  const anyOf2 = unwrapSchema(schema2);

  if (anyOf1.length !== anyOf2.length) return false;
  if (anyOf1.length === 0) return true;

  const typeComparator = (s1: Schema, s2: Schema) =>
    // @ts-ignore
    s1.type.toLocaleString().localeCompare(s2.type.toLocaleString());
  const sorted1 = [...anyOf1].sort(typeComparator);
  const sorted2 = [...anyOf2].sort(typeComparator);

  for (let i = 0; i < anyOf1.length; i++) {
    const s1 = sorted1[i];
    const s2 = sorted2[i];

    if (s1.type !== s2.type) return false;
    // @ts-ignore
    if (!options?.ignoreRequired && !areArraysEqual(s1.required, s2.required))
      return false;
    // @ts-ignore
    if (!arePropsEqual(s1.properties, s2.properties, options)) return false;
    // @ts-ignore
    if (!areSchemasEqual(s1.items, s2.items, options)) return false;
  }

  return true;
}

function areArraysEqual(arr1: string[], arr2: string[]): boolean {
  if (arr1 === undefined && arr2 === undefined) return true;
  if (arr1 === undefined || arr2 === undefined) return false;
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  const combined = new Set([...arr1, ...arr2]);
  return combined.size === set1.size && combined.size === set2.size;
}

function arePropsEqual(
  props1: Record<string, Schema>,
  props2: Record<string, Schema>,
  options?: SchemaComparisonOptions,
): boolean {
  if (props1 === undefined && props2 === undefined) return true;
  if (props1 === undefined || props2 === undefined) return false;
  const keys1 = Object.keys(props1);
  const keys2 = Object.keys(props2);
  if (!areArraysEqual(keys1, keys2)) return false;
  for (const key of keys1) {
    if (!areSchemasEqual(props1[key], props2[key], options)) return false;
  }
  return true;
}
