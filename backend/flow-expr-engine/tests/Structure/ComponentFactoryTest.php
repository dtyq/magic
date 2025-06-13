<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Test\Structure;

use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\Api\Api;
use Dtyq\FlowExprEngine\Structure\Condition\Condition;
use Dtyq\FlowExprEngine\Structure\Expression\Expression;
use Dtyq\FlowExprEngine\Structure\Expression\Value;
use Dtyq\FlowExprEngine\Structure\Form\Form;
use Dtyq\FlowExprEngine\Structure\StructureType;
use Dtyq\FlowExprEngine\Structure\Widget\Widget;
use Dtyq\FlowExprEngine\Test\BaseTestCase;

/**
 * @internal
 * @coversNothing
 */
class ComponentFactoryTest extends BaseTestCase
{
    public function testBuild()
    {
        $input = json_decode(
            <<<'JSON'
{
"id": "component-9527",
"version": "1",
"type": "expression",
"structure": [
    {
        "type": "methods",
        "value": "time",
        "name": "time",
        "args": null
    }
]

}

JSON
            ,
            true
        );
        $component = ComponentFactory::fastCreate($input);

        $this->assertEquals('expression', $component->getType()->value);
        $this->assertNotEmpty($component->getId());
        $this->assertInstanceOf(Expression::class, $component->getExpression());
    }

    public function testBuildFormLazy()
    {
        $input = json_decode(
            <<<'JSON'
{
    "id": "component-9527",
    "version": "1",
    "type": "form",
    "structure": {
        "key": "root",
        "sort": 0,
        "type": "object",
        "items": null,
        "title": "root节点",
        "value": null,
        "required": [
            "var1"
        ],
        "encryption": false,
        "properties": {
            "var1": {
                "key": "var1",
                "sort": 0,
                "type": "object",
                "items": null,
                "title": "变量名",
                "value": {
                    "type": "expression",
                    "expression_value": [
                        {
                            "args": null,
                            "name": "",
                            "type": "fields",
                            "value": "520872893193809920.var1"
                        }
                    ],
                    "const_value": []
                },
                "required": null,
                "encryption": false,
                "properties": null,
                "description": "",
                "encryption_value": null
            }
        },
        "description": null,
        "encryption_value": null
    }
}
JSON
            ,
            true
        );
        $component = ComponentFactory::fastCreate($input, lazy: true);

        $this->assertEquals('form', $component->getType()->value);
        $this->assertNotEmpty($component->getId());
        $this->assertInstanceOf(Form::class, $component->getForm());
        $result = $component->getForm()->getKeyValue(check: true, execExpression: false);
        $this->assertEquals(['var1' => null], $result);
    }

    public function testTemplate()
    {
        $component = ComponentFactory::generateTemplate(StructureType::Expression);
        $this->assertEquals(StructureType::Expression, $component->getType());
        $this->assertNotEmpty($component->getId());
        if ($component->getStructure()) {
            $this->assertInstanceOf(Expression::class, $component->getExpression());
        }

        $component = ComponentFactory::generateTemplate(StructureType::Form);
        $this->assertEquals(StructureType::Form, $component->getType());
        $this->assertNotEmpty($component->getId());
        if ($component->getStructure()) {
            $this->assertInstanceOf(Form::class, $component->getForm());
        }

        $component = ComponentFactory::generateTemplate(StructureType::Widget);
        $this->assertEquals(StructureType::Widget, $component->getType());
        $this->assertNotEmpty($component->getId());
        if ($component->getStructure()) {
            $this->assertInstanceOf(Widget::class, $component->getWidget());
        }

        $component = ComponentFactory::generateTemplate(StructureType::Condition);
        $this->assertEquals(StructureType::Condition, $component->getType());
        $this->assertNotEmpty($component->getId());
        if ($component->getStructure()) {
            $this->assertInstanceOf(Condition::class, $component->getCondition());
        }

        $component = ComponentFactory::generateTemplate(StructureType::Api);
        $this->assertEquals(StructureType::Api, $component->getType());
        $this->assertNotEmpty($component->getId());
        if ($component->getStructure()) {
            $this->assertInstanceOf(Api::class, $component->getApi());
        }

        $component = ComponentFactory::generateTemplate(StructureType::Value);
        $this->assertEquals(StructureType::Value, $component->getType());
        $this->assertNotEmpty($component->getId());
        if ($component->getStructure()) {
            $this->assertInstanceOf(Value::class, $component->getValue());
        }
    }
}
