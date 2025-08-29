# Componente Espressione v2 📝

## Esempio Base ⚙️

```jsx
import { MagicExpressionWidget } from '@/index';
import React,{ useState, useCallback } from "react"
import { mockDataSource, mockNodeMap } from "./components/dataSource"


export default () => {
    const [expression, setExpression] = useState(null)

    const onExpressionChange = useCallback((val) => {
        // console.log('value:', val)
        setExpression(val)
    }, [])

    return <MagicExpressionWidget value={expression} onChange={onExpressionChange} dataSource={mockDataSource} nodeMap={mockNodeMap}/>
}
```

## Supporto per Sorgente Dati Funzione 🔧

```jsx
import { MagicExpressionWidget } from '@/index';
import React,{ useState, useCallback } from "react"
import { mockDataSource, mockNodeMap } from "./components/dataSource"


export default () => {
    const [expression, setExpression] = useState(null)

    const onExpressionChange = useCallback((val) => {
        // console.log('value:', val)
        setExpression(val)
    }, [])

    return <MagicExpressionWidget value={expression} onChange={onExpressionChange} dataSource={mockDataSource} nodeMap={mockNodeMap}/>
}
```

## Supporto per Modalità Textarea 📝

```jsx
import { MagicExpressionWidget } from '@/index';
import React,{ useState, useCallback } from "react"
import { mockDataSource, mockNodeMap } from "./components/dataSource"
import methodExpressionSource from "./mock/expressionSource"
import { ExpressionMode } from "./constant"


export default () => {
    const [expression, setExpression] = useState(null)

    const onExpressionChange = useCallback((val) => {
        console.log('value:', val)
        setExpression(val)
    }, [])

    return <MagicExpressionWidget value={expression} onChange={onExpressionChange} dataSource={mockDataSource} mode={ExpressionMode.TextArea} pointedValueType="expression_value" nodeMap={mockNodeMap} methodsDataSource={methodExpressionSource} showExpand/>
}
```

## Supporto per Modifica Contenuto Campo Field ✏️

```jsx
import { MagicExpressionWidget } from '@/index';
import React,{ useState, useCallback } from "react"
import { mockDataSource } from "./components/dataSource"
import { ExpressionMode } from "./constant"


export default () => {
    const [expression1, setExpression1] = useState({
        "type": "expression",
        "const_value": [],
        "expression_value": [
            {
                "type": "fields",
                "value": "token_response.body",
                "name": "token响应body",
                "args": []
            },
            {
                "type": "input",
                "value": "['code']",
                "name": "",
                "args": []
            }
        ]
    })
    const [expression2, setExpression2] = useState(null)

    const onExpression1Change = useCallback((val) => {
        console.log('value1:', val)
        setExpression1(val)
    }, [])

    
    const onExpression2Change = useCallback((val) => {
        console.log('value2:', val)
        setExpression2(val)
    }, [])

    return <>
                <MagicExpressionWidget allowModifyField value={expression1} onChange={onExpression1Change} dataSource={mockDataSource} mode={ExpressionMode.Common} />
                <br/>
                <MagicExpressionWidget allowModifyField value={expression2} onChange={onExpression2Change} dataSource={mockDataSource} mode={ExpressionMode.TextArea} pointedValueType="expression_value"/>
            </>
}
```

## Disabilitato 🚫

```jsx
import { MagicExpressionWidget } from '@/index';
import React,{ useState, useCallback } from "react"
import { mockDataSource } from "./components/dataSource"


export default () => {
    const [expression, setExpression] = useState(null)

    const onExpressionChange = useCallback((val) => {
        console.log('value:', val)
        setExpression(val)
    }, [])

    return <MagicExpressionWidget value={expression} onChange={onExpressionChange} dataSource={mockDataSource} disabled/>
}
```

## Sorgente Dati Costante 📊

```jsx
import { MagicExpressionWidget } from '@/index';
import React,{ useState, useCallback } from "react"
import { mockDataSource } from "./components/dataSource"


export default () => {
    const [expression, setExpression] = useState(null)

    const constantSource = [{
        "title": "User",
        "key": "user",
        "nodeId": "",
        "nodeType": "21",
        "type": "string",
        "isRoot": false,
        "children": [],
        "isConstant": true
    },{
        "title": "System",
        "key": "system",
        "nodeId": "",
        "nodeType": "21",
        "type": "string",
        "isRoot": false,
        "children": [],
        "isConstant": true
    }]

    const onExpressionChange = useCallback((val) => {
        console.log('value:', val)
        setExpression(val)
    }, [])

    return <MagicExpressionWidget value={expression} onChange={onExpressionChange} constantDataSource={constantSource} multiple={false} dataSource={mockDataSource}/>
}
```

## Supporto per Aprire Modale di Modifica 🖼️

```jsx
import { MagicExpressionWidget } from '@/index';
import React,{ useState, useCallback } from "react"
import { mockDataSource, mockNodeMap } from "./components/dataSource"


export default () => {
    const [expression, setExpression] = useState(null)

    const onExpressionChange = useCallback((val) => {
        // console.log('value:', val)
        setExpression(val)
    }, [])

    return <MagicExpressionWidget value={expression} onChange={onExpressionChange} dataSource={mockDataSource} nodeMap={mockNodeMap} allowOpenModal showMultipleLine={false} onlyExpression disabled />
}
```

## Per Adattare Diversi Campi in Tabelle Multidimensionali 📋

```jsx
import { MagicExpressionWidget } from '@/index';
import React,{ useState, useCallback } from "react"
import { mockDataSource, mockNodeMap } from "./components/dataSource"
import { mockMultipleList } from "@/MagicExpressionWidget/components/nodes/LabelMultiple/mock"
import DepartmentModal from "./mock/DepartmentModal"


export default () => {
    const [expression, setExpression] = useState(null)

    const [multiple, setMultiple] = useState(null)

    const filterMemberList = []

    const [select, setSelect] = useState(null)

    const [datetime, setDatetime] = useState(null)

    const [checkbox, setCheckbox] = useState(null)
    
    const [departmentNames, setDepartmentNames] = useState(null)

    const [names, setNames] = useState(null)

    const onExpressionChange = useCallback((val) => {
        console.log('value:', val)
        setExpression(val)
    }, [])

    const onMultipleChange = useCallback((val) => {
        console.log('value:', val)
        setMultiple(val)
    }, []) 
    
    const onDatetimeChange = useCallback((val) => {
        console.log('value:', val)
        setDatetime(val)
    }, []) 

    const onCheckboxChange = useCallback((val) => {
        console.log('value:', val)
        setCheckbox(val)
    }, []) 

    
    const onSelectChange = useCallback((val) => {
        console.log('value:', val)
        setSelect(val)
    }, []) 

    
    const onDepartmentNamesChange = useCallback((val) => {
        console.log('value:', val)
        setDepartmentNames(val)
    }, []) 

    
    const onNamesChange = useCallback((val) => {
        console.log('value:', val)
        setNames(val)
    }, []) 

    const handleOk = useCallback(() => {
        console.log("ok")
    }, []) 


    return <>
        <strong>Membri</strong>
        <MagicExpressionWidget value={expression} onChange={onExpressionChange} dataSource={mockDataSource} nodeMap={mockNodeMap} renderConfig={{
            type: 'member',
            props: {
                options: [],
                value: [],
                onChange: () => {},
                searchType: 'member',
                onSearch: async () => {
                    const options = await Promise.resolve(filterMemberList)
                    return options
                }
            }
        }}/>


        <strong>Selezione Singola</strong>
        <MagicExpressionWidget value={select} onChange={onSelectChange} dataSource={mockDataSource} nodeMap={mockNodeMap} multiple={false} renderConfig={{
            type: 'select',
            props: {
                options: mockMultipleList,
                value: [],
                onChange: () => {}
            }
        }}/>

        <strong>Selezione Multipla</strong>
        <MagicExpressionWidget value={multiple} onChange={onMultipleChange} dataSource={mockDataSource} nodeMap={mockNodeMap} renderConfig={{
            type: 'multiple',
            props: {
                options: mockMultipleList,
                value: [],
                onChange: () => {}
            }
        }}/>
        
        <strong>Data</strong>
        <MagicExpressionWidget value={datetime} multiple={false} onChange={onDatetimeChange} dataSource={mockDataSource} nodeMap={mockNodeMap} renderConfig={{
            type: 'datetime',
            props: {
                value: [],
                onChange: () => {}
            }
        }}/>

        
        <strong>Checkbox</strong>
        <MagicExpressionWidget value={checkbox} multiple={false} onChange={onCheckboxChange} dataSource={mockDataSource} nodeMap={mockNodeMap} renderConfig={{
            type: 'checkbox',
            props: {
                value: null,
                onChange: () => {}
            }
        }}/>

        <strong>Dipartimenti</strong>
        <MagicExpressionWidget value={departmentNames} multiple={false} onChange={onDepartmentNamesChange} dataSource={mockDataSource} nodeMap={mockNodeMap} renderConfig={{
            type: 'department_names',
            props: {
                editComponent: DepartmentModal
            }
        }}/>


        <strong>Blocco Testo Generico</strong>
        <MagicExpressionWidget value={names} multiple={true} onChange={onNamesChange} dataSource={mockDataSource} nodeMap={mockNodeMap} renderConfig={{
            type: 'names',
            props: {
                value: null,
                onChange: () => {},
                editComponent: DepartmentModal,
                options: [{
                    id:"xxx",
                    label: "Base di Conoscenza di Test"
                },{
                    id:"yyy",
                    label: "Base di Conoscenza di Test 2"
                }],
                suffix: (item) => {
                    return <div onClick={() => {
                        console.log("item", item)
                    }}>111</div>
                }
            }
        }}/>
    </>
}
```


## Struttura Dati Sorgente Espressione 📊

Vedi l'esempio di espressione specifico

| Nome Parametro | Descrizione | Tipo | Obbligatorio |
| -------------- | ----------- | ---- | ------------ |
| label          | Etichetta   | string | Sì          |
| value          | Valore Selezionato Effettivo | string | Sì          |
| return_type    | Tipo di Ritorno Blocco Funzione, Presente Solo se l'Opzione a Cascata è una Funzione | string | -           |
| args           | Parametri di Input Blocco Funzione, È un Array di Blocchi Parametri, Presente Solo se l'Opzione a Cascata è una Funzione | array | -           |
| desc           | Descrizione Blocco Funzione, Presente Solo se l'Opzione a Cascata è una Funzione | string | -           |
| children       | Opzioni Figlie Blocco Funzione, Presente Solo se l'Opzione a Cascata è una Funzione | array | -           |

## API 🔌

| Nome Parametro | Descrizione | Tipo | Valore Predefinito |
| -------------- | ----------- | ---- | ------------------ |
| dataSource     | Sorgente Dati Espressione | DataSourceItem[](Vedi Sopra) | - |
| placeholder    | Segnaposto | string | - |
| mode           | Modalità Espressione | ExpressionMode | ExpressionMode.Common |
| value          | Valore Espressione | InputExpressionValue | - |
| onChange       | Funzione di Cambiamento Espressione | (value: InputExpressionValue) => void | () => {} |
| allowExpression| Se Consentire Espressione | boolean | false |
| pointedValueType| Specificare Tipo di Riempimento Espressione | 'const' o 'expression' | - |
| allowModifyField| Se Consentire Modifica Valore Field | false | - |
| disabled       | Se Disabilitato | false | - |
| multiple       | Se Selezione Multipla | true | - |

---

### Testo Originale (Spostato in Fondo) 📜

# 表达式组件 v2

## 基本的示例

```jsx
import { MagicExpressionWidget } from '@/index';
import React,{ useState, useCallback } from "react"
import { mockDataSource, mockNodeMap } from "./components/dataSource"


export default () => {
    const [expression, setExpression] = useState(null)

    const onExpressionChange = useCallback((val) => {
        // console.log('value:', val)
        setExpression(val)
    }, [])

    return <MagicExpressionWidget value={expression} onChange={onExpressionChange} dataSource={mockDataSource} nodeMap={mockNodeMap}/>
}
```

## 支持函数数据源

```jsx
import { MagicExpressionWidget } from '@/index';
import React,{ useState, useCallback } from "react"
import { mockDataSource, mockNodeMap } from "./components/dataSource"


export default () => {
    const [expression, setExpression] = useState(null)

    const onExpressionChange = useCallback((val) => {
        // console.log('value:', val)
        setExpression(val)
    }, [])

    return <MagicExpressionWidget value={expression} onChange={onExpressionChange} dataSource={mockDataSource} nodeMap={mockNodeMap}/>
}
```

## 支持文本域模式

```jsx
import { MagicExpressionWidget } from '@/index';
import React,{ useState, useCallback } from "react"
import { mockDataSource, mockNodeMap } from "./components/dataSource"
import methodExpressionSource from "./mock/expressionSource"
import { ExpressionMode } from "./constant"


export default () => {
    const [expression, setExpression] = useState(null)

    const onExpressionChange = useCallback((val) => {
        console.log('value:', val)
        setExpression(val)
    }, [])

    return <MagicExpressionWidget value={expression} onChange={onExpressionChange} dataSource={mockDataSource} mode={ExpressionMode.TextArea} pointedValueType="expression_value" nodeMap={mockNodeMap} methodsDataSource={methodExpressionSource} showExpand/>
}
```

## 支持修改field字段内容

```jsx
import { MagicExpressionWidget } from '@/index';
import React,{ useState, useCallback } from "react"
import { mockDataSource } from "./components/dataSource"
import { ExpressionMode } from "./constant"


export default () => {
    const [expression1, setExpression1] = useState({
        "type": "expression",
        "const_value": [],
        "expression_value": [
            {
                "type": "fields",
                "value": "token_response.body",
                "name": "token响应body",
                "args": []
            },
            {
                "type": "input",
                "value": "['code']",
                "name": "",
                "args": []
            }
        ]
    })
    const [expression2, setExpression2] = useState(null)

    const onExpression1Change = useCallback((val) => {
        console.log('value1:', val)
        setExpression1(val)
    }, [])

    
    const onExpression2Change = useCallback((val) => {
        console.log('value2:', val)
        setExpression2(val)
    }, [])

    return <>
                <MagicExpressionWidget allowModifyField value={expression1} onChange={onExpression1Change} dataSource={mockDataSource} mode={ExpressionMode.Common} />
                <br/>
                <MagicExpressionWidget allowModifyField value={expression2} onChange={onExpression2Change} dataSource={mockDataSource} mode={ExpressionMode.TextArea} pointedValueType="expression_value"/>
            </>
}
```

## 禁用

```jsx
import { MagicExpressionWidget } from '@/index';
import React,{ useState, useCallback } from "react"
import { mockDataSource } from "./components/dataSource"


export default () => {
    const [expression, setExpression] = useState(null)

    const onExpressionChange = useCallback((val) => {
        console.log('value:', val)
        setExpression(val)
    }, [])

    return <MagicExpressionWidget value={expression} onChange={onExpressionChange} dataSource={mockDataSource} disabled/>
}
```

## 常量数据源

```jsx
import { MagicExpressionWidget } from '@/index';
import React,{ useState, useCallback } from "react"
import { mockDataSource } from "./components/dataSource"


export default () => {
    const [expression, setExpression] = useState(null)

    const constantSource = [{
        "title": "User",
        "key": "user",
        "nodeId": "",
        "nodeType": "21",
        "type": "string",
        "isRoot": false,
        "children": [],
        "isConstant": true
    },{
        "title": "System",
        "key": "system",
        "nodeId": "",
        "nodeType": "21",
        "type": "string",
        "isRoot": false,
        "children": [],
        "isConstant": true
    }]

    const onExpressionChange = useCallback((val) => {
        console.log('value:', val)
        setExpression(val)
    }, [])

    return <MagicExpressionWidget value={expression} onChange={onExpressionChange} constantDataSource={constantSource} multiple={false} dataSource={mockDataSource}/>
}
```

## 支持打开弹窗编辑

```jsx
import { MagicExpressionWidget } from '@/index';
import React,{ useState, useCallback } from "react"
import { mockDataSource, mockNodeMap } from "./components/dataSource"


export default () => {
    const [expression, setExpression] = useState(null)

    const onExpressionChange = useCallback((val) => {
        // console.log('value:', val)
        setExpression(val)
    }, [])

    return <MagicExpressionWidget value={expression} onChange={onExpressionChange} dataSource={mockDataSource} nodeMap={mockNodeMap} allowOpenModal showMultipleLine={false} onlyExpression disabled />
}
```

## 用于适配多维表格不同字段

```jsx
import { MagicExpressionWidget } from '@/index';
import React,{ useState, useCallback } from "react"
import { mockDataSource, mockNodeMap } from "./components/dataSource"
import { mockMultipleList } from "@/MagicExpressionWidget/components/nodes/LabelMultiple/mock"
import DepartmentModal from "./mock/DepartmentModal"


export default () => {
    const [expression, setExpression] = useState(null)

    const [multiple, setMultiple] = useState(null)

    const filterMemberList = []

    const [select, setSelect] = useState(null)

    const [datetime, setDatetime] = useState(null)

    const [checkbox, setCheckbox] = useState(null)
    
    const [departmentNames, setDepartmentNames] = useState(null)

    const [names, setNames] = useState(null)

    const onExpressionChange = useCallback((val) => {
        console.log('value:', val)
        setExpression(val)
    }, [])

    const onMultipleChange = useCallback((val) => {
        console.log('value:', val)
        setMultiple(val)
    }, []) 
    
    const onDatetimeChange = useCallback((val) => {
        console.log('value:', val)
        setDatetime(val)
    }, []) 

    const onCheckboxChange = useCallback((val) => {
        console.log('value:', val)
        setCheckbox(val)
    }, []) 

    
    const onSelectChange = useCallback((val) => {
        console.log('value:', val)
        setSelect(val)
    }, []) 

    
    const onDepartmentNamesChange = useCallback((val) => {
        console.log('value:', val)
        setDepartmentNames(val)
    }, []) 

    
    const onNamesChange = useCallback((val) => {
        console.log('value:', val)
        setNames(val)
    }, []) 

    const handleOk = useCallback(() => {
        console.log("ok")
    }, []) 


    return <>
        <strong>成员</strong>
        <MagicExpressionWidget value={expression} onChange={onExpressionChange} dataSource={mockDataSource} nodeMap={mockNodeMap} renderConfig={{
            type: 'member',
            props: {
                options: [],
                value: [],
                onChange: () => {},
                searchType: 'member',
                onSearch: async () => {
                    const options = await Promise.resolve(filterMemberList)
                    return options
                }
            }
        }}/>


        <strong>单选</strong>
        <MagicExpressionWidget value={select} onChange={onSelectChange} dataSource={mockDataSource} nodeMap={mockNodeMap} multiple={false} renderConfig={{
            type: 'select',
            props: {
                options: mockMultipleList,
                value: [],
                onChange: () => {}
            }
        }}/>

        <strong>多选</strong>
        <MagicExpressionWidget value={multiple} onChange={onMultipleChange} dataSource={mockDataSource} nodeMap={mockNodeMap} renderConfig={{
            type: 'multiple',
            props: {
                options: mockMultipleList,
                value: [],
                onChange: () => {}
            }
        }}/>
        
        <strong>日期</strong>
        <MagicExpressionWidget value={datetime} multiple={false} onChange={onDatetimeChange} dataSource={mockDataSource} nodeMap={mockNodeMap} renderConfig={{
            type: 'datetime',
            props: {
                value: [],
                onChange: () => {}
            }
        }}/>

        
        <strong>Checkbox</strong>
        <MagicExpressionWidget value={checkbox} multiple={false} onChange={onCheckboxChange} dataSource={mockDataSource} nodeMap={mockNodeMap} renderConfig={{
            type: 'checkbox',
            props: {
                value: null,
                onChange: () => {}
            }
        }}/>

        <strong>部门</strong>
        <MagicExpressionWidget value={departmentNames} multiple={false} onChange={onDepartmentNamesChange} dataSource={mockDataSource} nodeMap={mockNodeMap} renderConfig={{
            type: 'department_names',
            props: {
                editComponent: DepartmentModal
            }
        }}/>


        <strong>通用文本块</strong>
        <MagicExpressionWidget value={names} multiple={true} onChange={onNamesChange} dataSource={mockDataSource} nodeMap={mockNodeMap} renderConfig={{
            type: 'names',
            props: {
                value: null,
                onChange: () => {},
                editComponent: DepartmentModal,
                options: [{
                    id:"xxx",
                    label: "测试的知识库"
                },{
                    id:"yyy",
                    label: "测试的知识库2"
                }],
                suffix: (item) => {
                    return <div onClick={() => {
                        console.log("item", item)
                    }}>111</div>
                }
            }
        }}/>
    </>
}
```


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
| dataSource      | 表达式数据源                | DataSourceItem[](见上)    | -      |
| placeholder     | 占位符                      | string                    | -      |
| mode            | 表达式模式                  | ExpressionMode            | ExpressionMode.Common      |
| value            | 表达式值           |   InputExpressionValue       | -      |
| onChange | 表达式变更函数 | (value: InputExpressionValue) => void                  | () => {}  |
| allowExpression | 是否允许表达式 | boolean                  | false  |
| pointedValueType | 指定表达式填值类型 | 'const'或'expression'                  | -  |
| allowModifyField | 是否允许修改field值 | false                  | -  |
| disabled | 是否禁用 | false                  | -  |
| multiple | 是否多选 | true                  | -  |
