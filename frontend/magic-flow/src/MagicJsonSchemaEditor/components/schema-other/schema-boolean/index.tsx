import { Col, Row, Select } from 'antd';
import _ from 'lodash';
import React, { ReactElement, useContext } from 'react';
import Schema from '../../../types/Schema';
import { EditorContext } from '../../editor';

const Option = Select.Option;

interface SchemaBooleanProp {
  data: Schema;
}

const changeOtherValue = (
  value: string,
  name: string,
  data: Schema,
  change: (newValue: Schema) => void,
) => {
  const valueForChange = value === 'true';
  const newData = _.cloneDeep(data);
  if (typeof value === 'undefined') {
    // @ts-ignore
    delete newData[name];
  } else {
    // @ts-ignore
    newData[name] = valueForChange;
  }
  change(newData);
};

const SchemaBoolean = (props: SchemaBooleanProp): ReactElement => {
  const { data } = props;
  const context = useContext(EditorContext);

  const value =
    data.default === undefined ? '' : data.default ? 'true' : 'false';
  return (
    <div>
      <div className="default-setting">base_setting</div>
      <Row className="other-row" align="middle">
        <Col span={4} className="other-label">
          default：
        </Col>
        <Col span={20}>
          <Select
            value={value}
            allowClear
            placeholder="default"
            style={{ width: 200 }}
            onChange={(value) => {
              changeOtherValue(
                value,
                'default',
                data,
                context.changeCustomValue,
              );
            }}
          >
            <Option value="true">true</Option>
            <Option value="false">false</Option>
          </Select>
        </Col>
      </Row>
    </div>
  );
};

export default SchemaBoolean;
