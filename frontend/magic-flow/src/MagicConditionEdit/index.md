# 条件组件 v2

## 基本的示例

```jsx
import { MagicConditionEdit } from '@/index';
import React,{ useState, useCallback } from "react"
import { mockDataSource, mockNodeMap } from "@/MagicExpressionWidget/components/dataSource"


export default () => {
    const [expression, setExpression] = useState(null)

    const onExpressionChange = useCallback((val) => {
        console.log('value:', val)
        setExpression(val)
    }, [])

    return <MagicConditionEdit value={expression} onChange={onExpressionChange} dataSource={mockDataSource} nodeMap={mockNodeMap}/>
}
```


## MagicConditionEditWrap

```jsx
import MagicConditionEditWrap from '@/common/BaseUI/MagicConditionWrap/index';
import React,{ useState, useCallback } from "react"
import { mockDataSource, mockNodeMap } from "@/MagicExpressionWidget/components/dataSource"


export default () => {
    const [expression, setExpression] = useState({
		id:"xxx",
		structure: undefined
	})

    const onExpressionChange = useCallback((val) => {
        console.log('value:', val)
    }, [])

    return <MagicConditionEditWrap value={expression.structure} onChange={onExpressionChange} dataSource={mockDataSource} nodeMap={mockNodeMap}/>
}
```





