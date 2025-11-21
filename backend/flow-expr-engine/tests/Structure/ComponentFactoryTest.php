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

    public function testInferExpressionType()
    {
        // Test inferring expression type from structure (without explicit type)
        $input = [
            'id' => 'component-test-expr',
            'structure' => [
                [
                    'type' => 'methods',
                    'value' => 'time',
                    'name' => 'time',
                    'args' => null,
                ],
            ],
        ];

        $component = ComponentFactory::fastCreate($input);

        $this->assertNotNull($component);
        $this->assertEquals('expression', $component->getType()->value);
        $this->assertInstanceOf(Expression::class, $component->getExpression());
    }

    public function testInferFormType()
    {
        // Test inferring form type from structure (without explicit type)
        $input = [
            'id' => 'component-test-form',
            'structure' => [
                'key' => 'root',
                'sort' => 0,
                'type' => 'object',
                'items' => null,
                'title' => 'Test Form',
                'value' => null,
                'required' => [],
                'properties' => [],
                'description' => null,
                'encryption' => false,
                'encryption_value' => null,
            ],
        ];

        $component = ComponentFactory::fastCreate($input);

        $this->assertNotNull($component);
        $this->assertEquals('form', $component->getType()->value);
        $this->assertInstanceOf(Form::class, $component->getForm());
    }

    public function testInferConditionType()
    {
        // Test inferring condition type from structure (without explicit type)
        $input = [
            'id' => 'component-test-condition',
            'structure' => [
                'ops' => 'AND',
                'children' => [
                    [
                        'type' => 'compare',
                        'condition' => 'equals',
                        'left_operands' => [
                            'type' => 'const',
                            'const_value' => [
                                [
                                    'type' => 'input',
                                    'value' => '1',
                                    'name' => '',
                                    'args' => null,
                                ],
                            ],
                            'expression_value' => [],
                        ],
                        'right_operands' => [
                            'type' => 'const',
                            'const_value' => [
                                [
                                    'type' => 'input',
                                    'value' => '1',
                                    'name' => '',
                                    'args' => null,
                                ],
                            ],
                            'expression_value' => [],
                        ],
                    ],
                ],
            ],
        ];

        $component = ComponentFactory::fastCreate($input);

        $this->assertNotNull($component);
        $this->assertEquals('condition', $component->getType()->value);
        $this->assertInstanceOf(Condition::class, $component->getCondition());
    }

    public function testInferApiType()
    {
        // Test inferring api type from structure (without explicit type)
        $input = [
            'id' => 'component-test-api',
            'structure' => [
                'method' => 'GET',
                'domain' => 'https://api.example.com',
                'path' => '/users',
                'request' => [],
            ],
        ];

        $component = ComponentFactory::fastCreate($input);

        $this->assertNotNull($component);
        $this->assertEquals('api', $component->getType()->value);
        $this->assertInstanceOf(Api::class, $component->getApi());
    }

    public function testInferApiTypeWithUrl()
    {
        // Test inferring api type from structure with url field (without explicit type)
        $input = [
            'id' => 'component-test-api-url',
            'structure' => [
                'method' => 'POST',
                'url' => 'https://api.example.com/data',
                'request' => [],
            ],
        ];

        $component = ComponentFactory::fastCreate($input);

        $this->assertNotNull($component);
        $this->assertEquals('api', $component->getType()->value);
        $this->assertInstanceOf(Api::class, $component->getApi());
    }

    public function testInferValueType()
    {
        // Test inferring value type from structure (without explicit type)
        $input = [
            'id' => 'component-test-value',
            'structure' => [
                'type' => 'expression',
                'const_value' => [
                    [
                        'type' => 'input',
                        'value' => 'test',
                        'name' => '',
                        'args' => null,
                    ],
                ],
                'expression_value' => [],
            ],
        ];

        $component = ComponentFactory::fastCreate($input);

        $this->assertNotNull($component);
        $this->assertEquals('value', $component->getType()->value);
        $this->assertInstanceOf(Value::class, $component->getValue());
    }

    public function testInferTypeWithExplicitTypeStillWorks()
    {
        // Test that explicit type takes precedence (backward compatibility)
        $input = [
            'id' => 'component-test-explicit',
            'type' => 'expression',
            'structure' => [
                [
                    'type' => 'methods',
                    'value' => 'time',
                    'name' => 'time',
                    'args' => null,
                ],
            ],
        ];

        $component = ComponentFactory::fastCreate($input);

        $this->assertNotNull($component);
        $this->assertEquals('expression', $component->getType()->value);
        $this->assertInstanceOf(Expression::class, $component->getExpression());
    }

    public function testInferTypeWithEmptyStructure()
    {
        // Test that empty structure with no type returns null in non-strict mode
        $input = [
            'id' => 'component-test-empty',
            'structure' => [],
        ];

        $component = ComponentFactory::fastCreate($input, strict: false);

        $this->assertNull($component);
    }

    public function testInferTypeWithInvalidStructure()
    {
        // Test that invalid structure (cannot infer type) returns null in non-strict mode
        $input = [
            'id' => 'component-test-invalid',
            'structure' => [
                'some_random_key' => 'value',
                'another_key' => 123,
            ],
        ];

        $component = ComponentFactory::fastCreate($input, strict: false);

        $this->assertNull($component);
    }

    public function testInferFormTypeWithArrayType()
    {
        // Test inferring form type with array structure
        $input = [
            'id' => 'component-test-form-array',
            'structure' => [
                'key' => 'items',
                'type' => 'array',
                'items' => [
                    'type' => 'string',
                ],
                'title' => 'Array Field',
                'value' => null,
            ],
        ];

        $component = ComponentFactory::fastCreate($input);

        $this->assertNotNull($component);
        $this->assertEquals('form', $component->getType()->value);
        $this->assertInstanceOf(Form::class, $component->getForm());
    }

    public function testInferExpressionTypeWithMultipleItems()
    {
        // Test inferring expression type with multiple expression items
        $input = [
            'id' => 'component-test-expr-multi',
            'structure' => [
                [
                    'type' => 'fields',
                    'value' => 'user.name',
                    'name' => 'User Name',
                    'args' => null,
                ],
                [
                    'type' => 'const',
                    'value' => ' - ',
                    'name' => 'separator',
                    'args' => null,
                ],
                [
                    'type' => 'fields',
                    'value' => 'user.email',
                    'name' => 'User Email',
                    'args' => null,
                ],
            ],
        ];

        $component = ComponentFactory::fastCreate($input);

        $this->assertNotNull($component);
        $this->assertEquals('expression', $component->getType()->value);
        $this->assertInstanceOf(Expression::class, $component->getExpression());
    }

    public function testInferTypeLazyMode()
    {
        // Test inferring type works in lazy mode
        $input = [
            'id' => 'component-test-lazy',
            'structure' => [
                'key' => 'root',
                'type' => 'object',
                'properties' => [
                    'field1' => [
                        'key' => 'field1',
                        'type' => 'string',
                        'title' => 'Field 1',
                    ],
                ],
            ],
        ];

        $component = ComponentFactory::fastCreate($input, lazy: true);

        $this->assertNotNull($component);
        $this->assertEquals('form', $component->getType()->value);
        // In lazy mode, structure is not loaded until getForm() is called
        $this->assertInstanceOf(Form::class, $component->getForm());
    }
}
