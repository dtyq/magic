import { EditOutlined } from '@ant-design/icons';
import { AutoComplete, Input } from 'antd';
import React, { ReactElement, useState } from 'react';
import { MOCK_SOURCE } from '../../constants';
import Schema from '../../types/Schema';

type MockSelectProp = {
  schema?: Schema;
  showEdit: () => void;
  onChange: (value: string) => void;
};

const MockSelect = (props: MockSelectProp): ReactElement => {
  const { schema } = props;

  const [open, setOpen] = useState(false);

  const children = MOCK_SOURCE.map((item) => ({
    label: item.name,
    value: item.mock,
  }));

  return (
    <div style={{ width: '100%' }}>
      <AutoComplete
        style={{ width: '100%' }}
        className="certain-category-search"
        dropdownMatchSelectWidth={false}
        options={children}
        filterOption
        value={
          schema?.mock
            ? typeof schema.mock !== 'string'
              ? schema.mock?.mock
              : schema.mock
            : ''
        }
        open={open}
        onChange={props.onChange}
        disabled={schema?.type === 'object' || schema?.type === 'array'}
      >
        <Input
          style={{ width: '100%' }}
          placeholder="mock"
          className={
            schema?.type === 'object' || schema?.type === 'array'
              ? 'input-icon-editor-disabled'
              : 'input-icon-editor'
          }
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          addonAfter={
            <EditOutlined
              className={
                schema?.type === 'object' || schema?.type === 'array'
                  ? 'input-icon-editor-disabled'
                  : 'input-icon-editor'
              }
              onClick={(e) => {
                e.stopPropagation();
                props.showEdit();
              }}
            />
          }
        />
      </AutoComplete>
    </div>
  );
};

export default MockSelect;
