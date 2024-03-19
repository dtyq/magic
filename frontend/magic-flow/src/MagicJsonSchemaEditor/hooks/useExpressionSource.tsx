/**
 * 管理当前表单组件自身数据源
 */

import _ from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { Common } from '../types/Common';
import Schema from '../types/Schema';

export type ExpressionSourceProps = {
  allowSourceInjectBySelf: boolean;
  uniqueFormId?: string;
};

export default function useExpressionSource({
  uniqueFormId,
  allowSourceInjectBySelf,
}: ExpressionSourceProps) {
  const [innerExpressionSourceMap, setInnerSourceMap] = useState(
    {} as Record<string, Common.Options>,
  );

  useEffect(() => {
    if (allowSourceInjectBySelf) {
    }
  }, [allowSourceInjectBySelf]);

  // json-schema转当前表单内部数据源map
  const tranSchemaToExpressionSourceMap = useCallback(
    (schema: Schema): Record<string, Common.Options> => {
      const result = {} as Record<string, Common.Options>;
      const beforeFieldsSource = [] as Common.Options;

      const gen = (root: Record<string, Schema>, parentKeys: string[]) => {
        Object.entries(root).forEach(([key, _schema]) => {
          const currentKey = [...parentKeys, key].join('.');
          result[currentKey] = _.cloneDeep(beforeFieldsSource);

          beforeFieldsSource.push({
            label: _schema.title || key,
            value: `${uniqueFormId}.${key}`,
          });
          // items优先级高，因为有items就表示是array类型，但是有properties有可能是array可能是object
          if (_schema.items) {
            gen({ items: _schema.items }, [...parentKeys, key]);
          } else if (_schema.properties) {
            gen(_schema.properties, [...parentKeys, key, 'properties']);
          }
        });
      };

      gen(schema.properties || {}, ['properties']);

      return result;
    },
    [uniqueFormId],
  );

  const updateInnerSourceMap = useCallback(
    (schema: Schema) => {
      if (!allowSourceInjectBySelf) return {} as Record<string, Common.Options>;
      // if (!uniqueFormId) console.error('props uniqueFormId 未传');

      const newInnerSourceMap = tranSchemaToExpressionSourceMap(schema);

      // console.log('newInnerSourceMap', newInnerSourceMap);

      // 将schema转成map
      setInnerSourceMap(newInnerSourceMap);

      return newInnerSourceMap;
    },
    [uniqueFormId, allowSourceInjectBySelf],
  );

  return {
    innerExpressionSourceMap,
    updateInnerSourceMap,
  };
}
