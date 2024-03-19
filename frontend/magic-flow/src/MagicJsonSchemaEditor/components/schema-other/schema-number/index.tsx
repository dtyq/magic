import { QuestionCircleOutlined } from '@ant-design/icons';
import {
  Checkbox,
  Col,
  Input,
  InputNumber,
  Row,
  Switch,
  Tooltip,
} from 'antd';
import _ from 'lodash';
import React, { ReactElement, useContext, useEffect, useState } from 'react';
import Schema from '../../../types/Schema';
import { EditorContext } from '../../editor';

const { TextArea } = Input;

interface SchemaNumberProp {
  data: Schema;
}

const changeOtherValue = (
  value: string | number | boolean | undefined,
  name: string,
  data: Schema,
  change: (newValue: Schema) => void,
) => {
  // @ts-ignore
  data[name] = value;
  change(data);
};

const SchemaNumber = (props: SchemaNumberProp): ReactElement => {
  const { data } = props;

  const [checked, setChecked] = useState<boolean>(
    props.data.enum !== undefined,
  );
  const [enumVal, setEnumVal] = useState<string>(
    props.data.enum === undefined ? '' : props.data.enum.join('\n'),
  );

  useEffect(() => {
    setEnumVal(props.data.enum === undefined ? '' : props.data.enum.join('\n'));
  }, [props.data.enum]);

  useEffect(() => {
    setChecked(props.data.enum !== undefined);
  }, [props.data.enum]);

  const context = useContext(EditorContext);

  const onChangeCheckBox = (checked: boolean, data: Schema) => {
    setChecked(checked);

    if (!checked) {
      delete data.enum;
      delete data.enumDesc;
      setEnumVal('');
      context.changeCustomValue(data);
    }
  };

  const changeEnumOtherValue = (value: string, data: Schema) => {
    let newEnumVal = value;
    const inputArr = newEnumVal.split('\n');
    if (data && data.type === 'number') {
      if (enumVal.split('\n').length === inputArr.length) {
        if (inputArr[inputArr.length - 1] === '') {
          newEnumVal = newEnumVal.slice(0, newEnumVal.length - 1);
        }
      }
    }
    setEnumVal(newEnumVal);
    const arr: string[] = newEnumVal.split('\n');
    const newData = _.cloneDeep(data);
    const newEnum: number[] = [];
    arr.forEach((item) => {
      if (!Number.isNaN(Number(item))) {
        newEnum.push(Number(item));
      } else {
        for (let i = 1; i < item.length + 1; i += 1) {
          if (Number.isNaN(Number(item.slice(0, i))) && i > 1) {
            newEnum.push(Number(item.slice(0, i - 1)));
            break;
          }
        }
      }
    });
    if (newEnum.length > 0 && newEnumVal !== '') {
      newData.enum = newEnum;
    } else {
      delete newData.enum;
      delete newData.enumDesc;
      setEnumVal('');
    }
    context.changeCustomValue(newData);
  };

  const changeEnumDescOtherValue = (value: string, data: Schema) => {
    data.enumDesc = value;
    context.changeCustomValue(data);
  };

  function handleDefaultValueChange(value: any) {
    changeOtherValue(value, 'default', data, context.changeCustomValue);
  }

  function handleExclusiveMinimumValueChange(value: any) {
    changeOtherValue(
      value,
      'exclusiveMinimum',
      data,
      context.changeCustomValue,
    );
  }

  function handleMinimumValueChange(value: any) {
    changeOtherValue(value, 'minimum', data, context.changeCustomValue);
  }

  function handleExclusiveMaximumValueChange(value: any) {
    changeOtherValue(
      value,
      'exclusiveMaximum',
      data,
      context.changeCustomValue,
    );
  }

  function handleMaximumValueChange(value: any) {
    changeOtherValue(value, 'maximum', data, context.changeCustomValue);
  }

  return (
    <div>
      <div className="default-setting">base_setting</div>
      <Row className="other-row" align="middle">
        <Col span={4} className="other-label">
          default：
        </Col>
        <Col span={20}>
          <Input
            value={data.default ? data.default.toString() : undefined}
            placeholder="default"
            onChange={(event) => handleDefaultValueChange(event.target.value)}
          />
        </Col>
      </Row>
      <Row className="other-row" align="middle">
        <Col span={12}>
          <Row align="middle">
            <Col span={13} className="other-label">
              <span>
                exclusiveMinimum&nbsp;
                <Tooltip title="exclusiveMinimum">
                  <QuestionCircleOutlined />
                </Tooltip>
                &nbsp;：
              </span>
            </Col>
            <Col span={11}>
              <Switch
                checked={data.exclusiveMinimum}
                onChange={handleExclusiveMinimumValueChange}
              />
            </Col>
          </Row>
        </Col>
        <Col span={12}>
          <Row align="middle">
            <Col span={13} className="other-label">
              <span>
                exclusiveMaximum&nbsp;
                <Tooltip title="exclusiveMaximum">
                  <QuestionCircleOutlined />
                </Tooltip>
                &nbsp;：
              </span>
            </Col>
            <Col span={11}>
              <Switch
                checked={data.exclusiveMaximum}
                onChange={handleExclusiveMaximumValueChange}
              />
            </Col>
          </Row>
        </Col>
      </Row>
      <Row className="other-row" align="middle">
        <Col span={12}>
          <Row align="middle">
            <Col span={8} className="other-label">
              minimum：
            </Col>
            <Col span={16}>
              <InputNumber
                value={data.minimum}
                style={{ width: '100%' }}
                placeholder="minimum"
                onChange={handleMinimumValueChange}
              />
            </Col>
          </Row>
        </Col>
        <Col span={12}>
          <Row align="middle">
            <Col span={8} className="other-label">
              maximum：
            </Col>
            <Col span={16}>
              <InputNumber
                value={data.maximum}
                style={{ width: '100%' }}
                placeholder="maximum"
                onChange={handleMaximumValueChange}
              />
            </Col>
          </Row>
        </Col>
      </Row>
      <Row className="other-row" align="middle">
        <Col span={4} className="other-label">
          <span>
            {'enum '}
            <Checkbox
              checked={checked}
              onChange={(event) => onChangeCheckBox(event.target.checked, data)}
            />{' '}
            ：
          </span>
        </Col>
        <Col span={20}>
          <TextArea
            value={enumVal}
            disabled={!checked}
            placeholder="enum_msg"
            autoSize={{ minRows: 2, maxRows: 6 }}
            onChange={(event) => changeEnumOtherValue(event.target.value, data)}
          />
        </Col>
      </Row>
      {checked && (
        <Row className="other-row" align="middle">
          <Col span={4} className="other-label">
            <span>enum_desc：</span>
          </Col>
          <Col span={20}>
            <TextArea
              value={data.enumDesc}
              disabled={!checked}
              placeholder="enum_desc_msg"
              autoSize={{ minRows: 2, maxRows: 6 }}
              onChange={(event) =>
                changeEnumDescOtherValue(event.target.value, data)
              }
            />
          </Col>
        </Row>
      )}
    </div>
  );
};

export default SchemaNumber;
