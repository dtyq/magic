<h1 align="center"> FlowExprEngine </h1>

<p align="center"> 一个强大的流程表达式引擎，用于创建和管理结构化组件。</p>


## 安装

```shell
$ composer require dtyq/flow-expr-engine -vvv
```

## 使用方法

```php
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

// 创建表单组件示例
$formComponent = ComponentFactory::generateTemplate(StructureType::Form);

// 更多使用方法...
``