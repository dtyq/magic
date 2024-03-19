# 表单组件 v2

```shell
yarn add @feb/json-schema-editor
```

## 基本使用

```jsx
import JsonSchemaEditor from './index';
import { useState } from "react";
import { mockDataSource, mockNodeMap } from "@/MagicExpressionWidget/components/dataSource"
import { ShowColumns } from "./constants";

export default () => {

    
    const [data, setData] = useState({
    "title": "",
    "description": "",
    "value": null,
    "type": "object",
    "properties": {
        "field_1": {
            "type": "object",
            "properties": {
                "field_23": {
                    "type": "string",
                    "title": "",
                    "description": "",
                    "value": null
                },
                "field_31": {
                    "type": "object",
                    "properties": {
                        "field_32": {
                            "type": "string",
                            "title": "",
                            "description": "",
                            "value": null
                        },
                        "field_33": {
                            "type": "array",
                            "title": "",
                            "description": "",
                            "value": null,
                            "items": {
                                "type": "string"
                            }
                        },
                        
                        "field_34": {
                            "type": "array",
                            "title": "",
                            "description": "",
                            "value": null,
                            "items": {
                                "type": "object"
                            },
                            "properties": {}
                        }
                    },
                    "required": [
                        "field_32",
                        "field_33"
                    ],
                    "title": "",
                    "description": "",
                    "value": null
                },
                "field_29": {
                    "type": "string",
                    "title": "",
                    "description": "",
                    "value": null
                }
            },
            "required": [
                "field_23",
                "field_29",
                "field_31"
            ],
            "title": "",
            "description": "",
            "value": null
        }
    },
    "required": [
        "field_1"
    ]
})


    const handleOnChange = value => {
        console.log("schema change", value)
        setData(value)
    }

    return <JsonSchemaEditor data={data} onChange={handleOnChange} allowExpression expressionSource={mockDataSource} nodeMap={mockNodeMap} displayColumns={[ShowColumns.Key, ShowColumns.Label, ShowColumns.Type, ShowColumns.Description, ShowColumns.Required]} />
}
```

## 支持表达式

该组件默认不支持表达式，如果需要支持表达式，需要将`allowExpression`设置为`true`，并且需要设置表达式数据源`expressionSource`

```jsx
import JsonSchemaEditor from './index';

import { mockDataSource, mockNodeMap } from "@/MagicExpressionWidget/components/dataSource"


const handleOnChange = value => {
    // console.log("schema change", value)
}


export default () => (
  <JsonSchemaEditor allowExpression expressionSource={mockDataSource} debuggerMode onChange={handleOnChange} nodeMap={mockNodeMap}/>
);
```

<!-- ## 根节点支持普通格式

根节点默认只支持 array、object 类型，如果需要让根节点接手其他类型需要把`onlyJson`设置为`false`

```jsx
import JsonSchemaEditor from './index';

const handleOnChange = value => {
    // console.log("schema change", value)
}


export default () => <JsonSchemaEditor onlyJson={false} onChange={handleOnChange}/>;
``` -->

## 不支持手动添加、删除元素

默认支持添加、删除元素的操作，如果将`allowOperation`设置为`false`，则不允许，只能通过数据联动

```jsx
import JsonSchemaEditor from './index';

const handleOnChange = value => {
    // console.log("schema change", value)
}


export default () => <JsonSchemaEditor allowOperation={false} onChange={handleOnChange}/>;
```

## 自定义参数类型可选项

目前可选项支持：`object、array、string、number、boolean` 类型，不属于其中的类型会被过滤掉，当同时设置`onlyJson`和`customOptions`，后者优先级更高

```jsx
import JsonSchemaEditor from './index';

const customOptions = {
  items: ['string', 'number'],
  root: ['object', 1, 'string', {}],
  normal: ['string', 'number', 'array'],
};

const handleOnChange = value => {
    // console.log("schema change", value)
}

export default () => <JsonSchemaEditor customOptions={customOptions} onChange={handleOnChange}/>;
```

<!-- ## 开启 json import 功能

```jsx
import JsonSchemaEditor from './index';

export default () => <JsonSchemaEditor jsonImport />;
``` -->

## 不生成第一个子节点

```jsx
import JsonSchemaEditor from './index';

export default () => <JsonSchemaEditor oneChildAtLeast={false} />;
```

## 自定义第一个子节点的key

```jsx
import JsonSchemaEditor from './index';

export default () => <JsonSchemaEditor firstChildKey="organization" />;
```

## 使用api形式新增节点

```jsx
import JsonSchemaEditor from './index';
import React from "react";
import { Button } from "antd";
import { nanoid } from "nanoid"
import _ from "lodash";

const refInstance = React.createRef(null)

const onAdd = () => {
    if(refInstance && refInstance.current) {
        const keys = new Array(1).fill(0).map(o => _.uniqueId("field_"))
        keys.forEach(key => {
            refInstance.current.addRootChildField(key)
        })
    }
}

const onDel = () => {
    if(refInstance && refInstance.current) {
        refInstance.current.deleteRootChildField('field_0')
    }
}

const onDelExcludeFirst = () => {
    if(refInstance && refInstance.current) {
        refInstance.current.deleteRootChildFieldsNotIn(['field_0'])
    }
}

export default () => <>
    <Button onClick={onAdd} type="primary">添加</Button>
    <Button onClick={onDel} type="primary" style={{marginLeft: '10px'}}>删除field_0节点</Button>
    <Button onClick={onDelExcludeFirst} type="primary" style={{marginLeft: '10px'}}>删除不是field_0之外的所有子节点</Button>
    <JsonSchemaEditor ref={refInstance} allowOperation={false}/>
</>;
```

## 禁用参数名的填写

```jsx
import JsonSchemaEditor from './index';

export default () => <JsonSchemaEditor disableFields={['key']} />;
```

## 不显示参数值列

```jsx
import JsonSchemaEditor from './index';
import { ShowColumns } from "./constants";

export default () => <JsonSchemaEditor displayColumns={[ShowColumns.Key, ShowColumns.Label, ShowColumns.Type, ShowColumns.Description]} />;
```

## 不显示参数类型和显示名称列

```jsx
import JsonSchemaEditor from './index';
import { ShowColumns } from "./constants";

export default () => <JsonSchemaEditor displayColumns={[ShowColumns.Key, ShowColumns.Value]} allowExpression/>;
```

## 自定义显示名称

```jsx
import JsonSchemaEditor from './index';
import { ShowColumns } from "./constants";

export default () => <JsonSchemaEditor columnNames={{
	[ShowColumns.Label]: "变量名称",
	[ShowColumns.Key]: "变量Key"
}}/>;
```

## 不允许添加参数

```jsx
import JsonSchemaEditor from './index';
import { ShowColumns } from "./constants";

export default () => <JsonSchemaEditor showAdd={false} showOperation={false}/>;
```

## 特殊字段处理

```jsx
import JsonSchemaEditor from './index';
import { useState } from "react";
import { mockDataSource, mockNodeMap } from "@/MagicExpressionWidget/components/dataSource"
import { ShowColumns } from "./constants";
import { DisabledField } from "./types/Schema"

export default () => {

    
    const [data, setData] = useState({
		"type": "array",
		"key": "root",
		"sort": 0,
		"title": "上下文记忆",
		"description": "",
		"required": null,
		"value": null,
		"items": {
			"type": "object",
			"key": "messages",
			"sort": 0,
			"title": "历史消息",
			"description": "",
			"required": [
				"role",
				"content"
			],
			"value": null,
			"items": null,
			"properties": {
				"role": {
					"type": "string",
					"key": "role",
					"sort": 0,
					"title": "角色",
					"description": "",
					"required": null,
					"value": null,
					"items": null,
					"properties": null
				},
				"content": {
					"type": "string",
					"key": "content",
					"sort": 1,
					"title": "内容",
					"description": "",
					"required": null,
					"value": null,
					"items": null,
					"properties": null
				}
			}
		},
		"properties": null
	})

	const mockConstantExpressionOptions = [{
		"title": "常量",
		"key": "",
		"nodeId": "Wrapper",
		"nodeType": "21",
		"type": "",
		"isRoot": true,
		"children": [
			{
				"title": "用户",
				"key": "user",
				"nodeId": "",
				"nodeType": "21",
				"type": "string",
				"isRoot": false,
				"children": [],
				"isConstant": true
			},
			{
				"title": "机器人",
				"key": "system",
				"nodeId": "",
				"nodeType": "21",
				"type": "string",
				"isRoot": false,
				"children": [],
				"isConstant": true
			}
		]
	}]


    const handleOnChange = value => {
        // console.log("schema change", value)
        setData(value)
    }

    return <JsonSchemaEditor data={data} onChange={handleOnChange} allowExpression expressionSource={mockDataSource} nodeMap={mockNodeMap}  displayColumns={[ShowColumns.Key, ShowColumns.Label, ShowColumns.Type, ShowColumns.Value]} showImport={false} disableFields={[DisabledField.Title, DisabledField.Type]} allowAdd={false} onlyExpression customFieldsConfig={{
		role: {
			allowOperation: false,
			constantsDataSource: mockConstantExpressionOptions,
			onlyExpression: false
		},
		content: {
			allowOperation: false,
		},
		root: {
			allowOperation: true,
			allowAdd: true
		}
	}} showTopRow />
}
```

## 支持加密

如果需要进行字段的隐藏显示，则需要开启加密字段，并且需要由后端进行加密后赋值到encryption_value，value会一直是null，如果修改了value，则后端会进一步进行加密

```jsx
import JsonSchemaEditor from './index';
import { useState } from "react";
import { mockDataSource, mockNodeMap } from "@/MagicExpressionWidget/components/dataSource"
import { ShowColumns } from "./constants";

export default () => {

    
    const [data, setData] = useState({
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": "",
    "description": "",
    "required": [
        "field_1",
        "asdasd",
        "field_3",
        "field_4"
    ],
    "value": null,
    "encryption": false,
    "encryption_value": null,
    "items": null,
    "properties": {
        "field_1": {
            "type": "string",
            "key": "field_1",
            "sort": 0,
            "title": "",
            "description": "",
            "required": null,
            "value": null,
            "encryption": true,
            "encryption_value": "K41OmxJPvR4JUmijEaWdv9EmezfQfLHTem2cL0VN4hU6a8ahv9g6zPeUGpYT9nrcLQVyHERJyEd6qAMN55q3E8fsT6QWvgbAiC4EfaVy+XVdaISddg3GOARRWhvr0BXQN2aI9IToI9IDcFd4dkIanxBeob9nFnKKrv1gyMiNt4cC1Aj55r0k4wY0xC2y6tmXnjzTlF3WZn7JJgI4S+9nJhAdviwFBGeUNsH1Z9hVW/A3ovUzMHc2Q/t3u0X8aPhoqFIl3XuZAv95txnhMkUR30mG63n/FgtFKU+ebCKBqnuePNOUXdZmfskmAjhL72cmMO+QDVSv3mh1hkandPmTuwSyGErs71nMWFbbY9BZxkU1e6j0yiGzRMVBwLWMBDzI7d5p/GCniW5Kp7Cvg6VqcyKmK9p5h50RNreq4OInO51dDOvNzSMKaPI04Kc7o+bE/XoeaMOCyad5/DZV7BIPCL3OrDI1EEvvtST5Kiivt0vdvIFtzkp64EL9pqmAzxvM4IHL7NIh042Njv1hlpxSOdEmezfQfLHTem2cL0VN4hUACJt4YUbrBo8S4GJKqJjC1D9ixvNEW8vG8Cy6QT+YdnGqAN9kCQOHdjB//S2z66um8cjgdp3mHKejPDi/ZOJ+8s6SIp5M7TSsCcicxZFs/HUN2N2c/uA8uQ+/d59R0RaVXMF3+2lxyy8aiJfXOfaiJS0DVduXFXzRWI1pqs1Wx7sxS6dtI7Cu/KGkeQqIPLelcIE8CcDeR/LOAA3hVCMNM26W0MmeRo7L+ve6tNkxrNoh6VJMdRVNLLgf9IooSrSjNlr6LaRlLuAyO0P+vyamuzFLp20jsK78oaR5Cog8t6VwgTwJwN5H8s4ADeFUIw0zbpbQyZ5Gjsv697q02TGsc5f10+cx/2U4c38tkolzJIHOayHIiMH+4ZravpPtdxYgk/5JhyfYD8dm8slDyA8qDASYBK5EWiczCUQGGkMiRtAA/EBxVHXXtHPoargWUIKHeLJm9ntHnhEq+dntgZ3xgFwujkc8IYUMHJA3yzbn/SWyjuni1JnFpuQTrTiMqxddkcAPZlV8ZqHF8UUI7e9Ny5gUS0qQ1NskGhdpr9qTAa/PlqETXuZf0qLIjp5VZV9BIVTLJ+c/mrIcOg4Sufj8JbKO6eLUmcWm5BOtOIyrF12RwA9mVXxmocXxRQjt70002ay3JkpMdyP2aUakbZ1w1iMB0BdD/+0XopzaGB1Ig8llv5sy09ixMuj93xEqkXlT40KWn9e7OCq2fUjsxcL0BoPsSPEqZISbuH2AI7bRa9EmezfQfLHTem2cL0VN4hU6a8ahv9g6zPeUGpYT9nrcI6SvWOl/9JJNI6brc+/HwNOSPkCm6IQaKdZfvZE2ZQCm8cjgdp3mHKejPDi/ZOJ+Qgs6xAwHQf5lwjXcz2eYq0RPp5f5t1J1KgrmQTYkwawFU4Y9dgMnLnD5aTgEgg4o",
            "items": null,
            "properties": null
        },
        "asdasd": {
            "type": "string",
            "key": "asdasd",
            "sort": 1,
            "title": "",
            "description": "",
            "required": null,
            "value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "ffff",
                        "name": "",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        },
        "field_3": {
            "type": "number",
            "key": "field_3",
            "sort": 2,
            "title": "",
            "description": "",
            "required": null,
            "value": null,
            "encryption": true,
            "encryption_value": "dZHgX9xkPmvAX3iawchn+n4YjK4pK8AB/GRMmwqX4KAsRahYby6DfQf98OuEHSJaHAGe6wWsGPkt6wS0/TNRW336zbPRtMDqcZVv42dNmD9Q9SUi7J6/M2ePVJDARiA8AZSdbVzfQJyhpchMZZ0aVSoO/WpWujtylJbWNWy2ebk5wRRyxE/aub3IMTNGkL1DVP6uYhXww1UnWDkpywpvzcCzgna+zojatUlZI36JsVHEB5AqfVMKtjQEDFAXExzYLujBv7fLdD9DJ0byMVb3+FoGJ+bsWRhYlYs/j2a0Eg5U/q5iFfDDVSdYOSnLCm/NRpC8H+fCMatz+H5UOr2VJQwj5lZukkHxT2oUROLS8baWmk01J2gHjSlFG2i763MCm3hTUrL/5fnNBC3amche7KgHLSgT12ZRpdEUIOj4LNJ3RPrekcnbpljdMlGW/nlYmnSU5XqOJqY0P9psPb5dTtIMOi77TRMszZu6Yhlvp8z/P2Csacg8xKT6pHwEfWPm1Zj9QHHe+XWZlZBD2t4dW34YjK4pK8AB/GRMmwqX4KCNQ+PD5Nwqf4YCubwdbEoQb1sN5gfOWI/bHAkx/1GyKplPnYmo44jC8S+ld4uWT24iBGk0bDSsLwWfrlcQ8xWB1qEXXY2wYYVLyI47nXo+25iqaX1yURrFVS6jhXE1oS0aVpZBft0443v8LESYpyqH03y12RRYZb+W2YbkDmZVoyK3XWLjdusAQsXRvrC9AumPZueznF1XvnLQcRtiCIzH3AWeERgiYCSqI+4PQ4Ax/wzcaLnccPnZJ3MyHelY4dJlCO3kL+296y4IR8sqMabZIrddYuN26wBCxdG+sL0C6Y9m57OcXVe+ctBxG2IIjMfcBZ4RGCJgJKoj7g9DgDH/P1VmcCvJhNDRaR7OdEBWRYwEE34e4hlDaMIs2NAzR89sOUUNm0ER3OLrb6ubZhSHukSg3BDdsLclyt1vLG2c2nie4JE1lgWLHsAGRzN0+oB/7Pw05FJly08NOl/+aK2hi9sJJejoDdKi8TUE8RdSRwGUnW1c30CcoaXITGWdGlUFDJ/j28MAf8wWSurg84OGg2C3jvB+OesjZubtdrm7xyX4KYjR0cgQBUjwcWohfKQOa+otk6jL2dBp44jKyuMbAZSdbVzfQJyhpchMZZ0aVQUMn+PbwwB/zBZK6uDzg4aRJJhxkWmzVpo7wDS7HwzOsz0GHeerUQwfBU7imkFoYrBB2nI2klE2LJ3n66XUTf1CJWTJaV6AIsMxUgMI7QNB4bxcKVAWXN7oZmK7SVjWhZwulCQoZFSk1ccg1HxGEjdOvQErR6xrxAPDxpFq1Zr6lQ6BlecKtnwQbTtRiyPQNWNzj0de9qBB/515HIakuS9rJ8XqdafeoeFS9WfoFCIaHos4uOt6+L+bIxhdYcCVqHlMyAOE1nmxFYkOFbRNn2A=",
            "items": null,
            "properties": null
        },
        "field_4": {
            "type": "boolean",
            "key": "field_4",
            "sort": 3,
            "title": "",
            "description": "",
            "required": null,
            "value": {
                "type": "expression",
                "const_value": null,
                "expression_value": [
                    {
                        "type": "input",
                        "value": "dddd",
                        "name": "",
                        "args": null
                    }
                ]
            },
            "encryption": false,
            "encryption_value": null,
            "items": null,
            "properties": null
        }
    }
})


    const handleOnChange = value => {
        // console.log("schema change", value)
        setData(value)
    }

  return <JsonSchemaEditor data={data} allowExpression expressionSource={mockDataSource} debuggerMode onChange={handleOnChange} nodeMap={mockNodeMap} displayColumns={[ShowColumns.Key, ShowColumns.Label, ShowColumns.Type, ShowColumns.Description, ShowColumns.Value, ShowColumns.Encryption, ShowColumns.Required]}/>
}
```


























<!-- ## 允许使用当前表单的字段作为表达式数据源

```jsx
import JsonSchemaEditor from './index';

const source = [
    {
        "label": "系统变量",
        "value": "fields_6530fe660cd5f",
        "desc": "",
        "children": [
            {
                "label": "http状态码",
                "value": "guzzle.response.http_code"
            }
        ]
    }
]


const handleOnChange = value => {
    console.log("schema change", value)
}


export default () => (
  <JsonSchemaEditor allowExpression expressionSource={source} allowSourceInjectBySelf  uniqueFormId="XXXXXX" onChange={handleOnChange}/>
);
``` -->

<!-- ## 注入上文表达式数据源

```jsx
import JsonSchemaEditor from './index';

const source = [
    {
        "label": "系统变量",
        "value": "fields_6530fe660cd5f",
        "desc": "",
        "children": [
            {
                "label": "http状态码",
                "value": "guzzle.response.http_code"
            }
        ]
    }
]

const contextSource = [
    {
        "label": "入参配置",
        "value": "fields",
        "desc": "",
        "children": [
            {
                "label": "上文字段一",
                "value": "XXX.one"
            },
            {
                "label": "上文字段二",
                "value": "XXX.two"
            }
        ]
    }
]

const handleOnChange = value => {
    // console.log("schema change", value)
}

const handleInnerSourceChange = innerSource => {
    // console.log("inner source map", innerSource)
}


export default () => (
  <JsonSchemaEditor allowExpression expressionSource={source} contextExpressionSource={contextSource} onChange={handleOnChange} onInnerSourceMapChange={handleInnerSourceChange}/>
);
``` -->

<!-- ## 开启 调试模式

```jsx
import JsonSchemaEditor from './index';

export default () => <JsonSchemaEditor debuggerMode />;
``` -->

<!-- ## json 编辑器

```jsx
import JsonSchemaEditor from './index';

export default () => <JsonSchemaEditor jsonEditor />;
``` -->

<!-- ## Notice

```shell
npm install monaco-editor
```

组件中的 JSON 编辑器用的是在线加载 cdn 的方式，离线使用需添加以下内容

```jsx ｜ pure
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
loader.config({ monaco });
``` -->

## 表达式数据源数据结构

具体看表达式示例

| 参数名称    | 描述                                               | 类型   | 是否必填 |
| ----------- | -------------------------------------------------- | ------ | -------- |
| label       | 标签                                               | string | 是       |
| value       | 实际选中值                                         | string | 是       |
| return_type | 函数块返回值类型，级联选项是函数时才有             | string | -        |
| args        | 函数块入参，是一个参数块数组，级联选项是函数时才有 | array  | -        |
| desc        | 函数块描述，级联选项是函数时才有                   | string | -        |
| children    | 函数块子选项，级联选项是函数时才有                 | array  | -        |

## API

| 参数名称        | 描述                       | 类型                     | 默认值 |
| --------------- | -------------------------- | ------------------------ | ------ |
| jsonEditor      | 是否展示 json 编辑器       | boolean                  | -      |
| onChange        | Schema 变更的回调          | (schema: Schema) => void | -      |
| onBlur        | 编辑器 失去焦点的回调          | (schema: Schema) => void | -      |
| data            | 初始化 Schema              | Schema or string         | -      |
| allowExpression | 是否允许参数值用表达式形式 | boolean                  | false  |
| onlyJson        | 是否根节点只支持复杂类型   | boolean                  | true   |
| customOptions   | 自定义节点可选项           | object                   | {}     |
| jsonImport      | 是否开启 import json 功能  | boolean                  | false  |
| debuggerMode    | 是否开启调试结果模式       | boolean                  | false  |
| allowOperation    | 是否支持手动添加、删除元素       | boolean                  | true  |
| oneChildAtLeast    | 是否最少一个子节点       | boolean                  | true  |
| firstChildKey    | 默认生成的第一个子节点的key       | string                  | field_0  |
| disabledFields    | 全局禁用某些字段，不可让用户填写       | DisableField[]     | []  |
| appendPosition    | 插入方式，当前元素后位还是尾部添加       | AppendPosition     | AppendPosition.Next  |
| allowSourceInjectBySelf      | 是否允许计算当前表单的字段作为数据源      | boolean     | false  |
| uniqueFormId    | 当前表单唯一id      | string     | -  |
| contextExpressionSource    | 上文表达式数据源      | ExpressionSource     | -  |
| onInnerSourceMapChange | 当前表单内部表达式数据源变更函数   | (innerSource: Record<string, Common.Options>) => void | -  |
| displayColumns | 可以显示的列   | ShowColumns[] | [1,2,3,4]  |

