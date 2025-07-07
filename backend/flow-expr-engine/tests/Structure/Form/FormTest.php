<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Test\Structure\Form;

use Dtyq\FlowExprEngine\Builder\FormBuilder;
use Dtyq\FlowExprEngine\Builder\ValueBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Exception\FlowExprEngineException;
use Dtyq\FlowExprEngine\Structure\Expression\DataType;
use Dtyq\FlowExprEngine\Structure\Form\Form;
use Dtyq\FlowExprEngine\Structure\Form\FormType;
use Dtyq\FlowExprEngine\Test\BaseTestCase;

/**
 * @internal
 * @coversNothing
 */
class FormTest extends BaseTestCase
{
    private FormBuilder $builder;

    public function setUp(): void
    {
        parent::setUp();
        $this->builder = new FormBuilder();
    }

    public function testBuild()
    {
        $builder = new FormBuilder();

        $form = $builder->build($this->getFormJsonArray());
        $this->assertInstanceOf(Form::class, $form);
        $this->assertEquals($this->getFormJsonArray(), $form->toArray());

        $form2 = $builder->build($this->getFormJsonArray2());
        $this->assertInstanceOf(Form::class, $form2);
        $this->assertEquals($this->getFormJsonArray2(), $form2->toArray());
    }

    public function testToJsonSchema()
    {
        $builder = new FormBuilder();

        $form = $builder->build($this->getFormJsonArray());
        $this->assertInstanceOf(Form::class, $form);
        $this->assertIsArray($form->toJsonSchema());

        $form2 = $builder->build($this->getFormJsonArray2());
        $this->assertInstanceOf(Form::class, $form2);
        $this->assertIsArray($form2->toJsonSchema());
    }

    public function testToJsonSchemaWithThrowFalse()
    {
        $builder = new FormBuilder();

        // Test object with empty properties - should not include properties field
        $emptyObjectForm = $builder->build(json_decode(
            <<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": "Empty Object",
    "description": "An object with no properties",
    "required": [],
    "value": null,
    "items": null,
    "properties": {}
}
JSON,
            true
        ));

        $schema = $emptyObjectForm->toJsonSchema(false);
        $this->assertEquals('object', $schema['type']);
        $this->assertEquals([], $schema['required']);
        $this->assertEquals('An object with no properties', $schema['description']);
        // Should not have properties field when empty and throw=false
        $this->assertArrayNotHasKey('properties', $schema);

        // Test array with no items - should not include items field
        $emptyArrayForm = $builder->build(json_decode(
            <<<'JSON'
{
    "type": "array",
    "key": "root",
    "sort": 0,
    "title": "Empty Array",
    "description": "An array with no items",
    "required": null,
    "value": null,
    "items": null,
    "properties": null
}
JSON,
            true
        ));

        $schema = $emptyArrayForm->toJsonSchema(false);
        $this->assertEquals('array', $schema['type']);
        $this->assertEquals([], $schema['required']);
        $this->assertEquals('An array with no items', $schema['description']);
        // Should not have items field when empty and throw=false
        $this->assertArrayNotHasKey('items', $schema);
    }

    public function testToJsonSchemaWithThrowTrue()
    {
        $builder = new FormBuilder();

        // Test object with empty properties - should throw exception
        $emptyObjectForm = $builder->build(json_decode(
            <<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": "Empty Object",
    "description": "An object with no properties",
    "required": [],
    "value": null,
    "items": null,
    "properties": {}
}
JSON,
            true
        ));

        $this->expectException(FlowExprEngineException::class);
        $this->expectExceptionMessage('[root] Object type must have properties');
        $emptyObjectForm->toJsonSchema(true);
    }

    public function testToJsonSchemaArrayWithThrowTrue()
    {
        $builder = new FormBuilder();

        // Test array with no items - should throw exception
        $emptyArrayForm = $builder->build(json_decode(
            <<<'JSON'
{
    "type": "array",
    "key": "root",
    "sort": 0,
    "title": "Empty Array",
    "description": "An array with no items",
    "required": null,
    "value": null,
    "items": null,
    "properties": null
}
JSON,
            true
        ));

        $this->expectException(FlowExprEngineException::class);
        $this->expectExceptionMessage('[root] Array type must have items');
        $emptyArrayForm->toJsonSchema(true);
    }

    public function testToJsonSchemaRecursiveThrowParameter()
    {
        $builder = new FormBuilder();

        // Test that throw parameter is passed down recursively
        $nestedForm = $builder->build(json_decode(
            <<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": "Parent Object",
    "description": "Parent with nested empty object",
    "required": ["child"],
    "value": null,
    "items": null,
    "properties": {
        "child": {
            "type": "object",
            "key": "child",
            "sort": 0,
            "title": "Child Object",
            "description": "Child with no properties",
            "required": [],
            "value": null,
            "items": null,
            "properties": {}
        }
    }
}
JSON,
            true
        ));

        // Should work with throw=false (skip empty nested object)
        $schema = $nestedForm->toJsonSchema(false);
        $this->assertEquals('object', $schema['type']);
        $this->assertArrayHasKey('properties', $schema);
        $this->assertArrayHasKey('child', $schema['properties']);
        // Child should not have properties field when empty
        $this->assertArrayNotHasKey('properties', $schema['properties']['child']);

        // Should throw exception with throw=true (nested empty object)
        $this->expectException(FlowExprEngineException::class);
        $this->expectExceptionMessage('[child] Object type must have properties');
        $nestedForm->toJsonSchema(true);
    }

    public function testToJsonSchemaWithValidStructure()
    {
        $builder = new FormBuilder();

        // Test valid structure works with both throw=false and throw=true
        $validForm = $builder->build(json_decode(
            <<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": "Valid Object",
    "description": "Object with valid properties",
    "required": ["name", "items"],
    "value": null,
    "items": null,
    "properties": {
        "name": {
            "type": "string",
            "key": "name",
            "sort": 0,
            "title": "Name",
            "description": "Person name",
            "required": null,
            "value": null,
            "items": null,
            "properties": null
        },
        "items": {
            "type": "array",
            "key": "items",
            "sort": 1,
            "title": "Items",
            "description": "List of items",
            "required": null,
            "value": null,
            "items": {
                "type": "string",
                "key": "item",
                "sort": 0,
                "title": "Item",
                "description": "Single item",
                "required": null,
                "value": null,
                "items": null,
                "properties": null
            },
            "properties": null
        }
    }
}
JSON,
            true
        ));

        // Test with throw=false
        $schemaFalse = $validForm->toJsonSchema(false);
        $this->assertEquals('object', $schemaFalse['type']);
        $this->assertEquals(['name', 'items'], $schemaFalse['required']);
        $this->assertArrayHasKey('properties', $schemaFalse);
        $this->assertArrayHasKey('name', $schemaFalse['properties']);
        $this->assertArrayHasKey('items', $schemaFalse['properties']);
        $this->assertEquals('array', $schemaFalse['properties']['items']['type']);
        $this->assertArrayHasKey('items', $schemaFalse['properties']['items']);
        $this->assertEquals('string', $schemaFalse['properties']['items']['items']['type']);

        // Test with throw=true (should work the same)
        $schemaTrue = $validForm->toJsonSchema(true);
        $this->assertEquals($schemaFalse, $schemaTrue);
    }

    public function testToJsonSchemaArrayWithEmptyObjectItems()
    {
        $builder = new FormBuilder();

        // Test array with items that have empty object properties
        $arrayForm = $builder->build(json_decode(
            <<<'JSON'
{
    "type": "array",
    "key": "root",
    "sort": 0,
    "title": "Array with Empty Object Items",
    "description": "Array containing objects with no properties",
    "required": null,
    "value": null,
    "items": {
        "type": "object",
        "key": "item",
        "sort": 0,
        "title": "Item",
        "description": "Empty object item",
        "required": [],
        "value": null,
        "items": null,
        "properties": {}
    },
    "properties": null
}
JSON,
            true
        ));

        // Should work with throw=false - FormBuilder will skip empty object items
        $schema = $arrayForm->toJsonSchema(false);
        $this->assertEquals('array', $schema['type']);
        // Since FormBuilder doesn't create items for empty objects, items field should not exist
        $this->assertArrayNotHasKey('items', $schema);

        // Should throw exception with throw=true because there are no items at all
        $this->expectException(FlowExprEngineException::class);
        $this->expectExceptionMessage('[root] Array type must have items');
        $arrayForm->toJsonSchema(true);

        // Note: We don't test the valid items case here since this method will stop after the exception
    }

    public function testToJsonSchemaArrayWithValidItems()
    {
        $builder = new FormBuilder();

        // Test with a properly structured array that has items with properties
        $arrayWithValidItems = $builder->build(json_decode(
            <<<'JSON'
{
    "type": "array",
    "key": "root",
    "sort": 0,
    "title": "Array with Valid Object Items",
    "description": "Array containing objects with properties",
    "required": null,
    "value": null,
    "items": {
        "type": "object",
        "key": "item",
        "sort": 0,
        "title": "Item",
        "description": "Object item with properties",
        "required": ["name"],
        "value": null,
        "items": null,
        "properties": {
            "name": {
                "type": "string",
                "key": "name",
                "sort": 0,
                "title": "Name",
                "description": "Item name",
                "required": null,
                "value": null,
                "items": null,
                "properties": null
            }
        }
    },
    "properties": null
}
JSON,
            true
        ));

        // This should work with both throw modes
        $validSchema = $arrayWithValidItems->toJsonSchema(false);
        $this->assertEquals('array', $validSchema['type']);
        $this->assertArrayHasKey('items', $validSchema);
        $this->assertEquals('object', $validSchema['items']['type']);
        $this->assertArrayHasKey('properties', $validSchema['items']);

        $validSchemaThrow = $arrayWithValidItems->toJsonSchema(true);
        $this->assertEquals($validSchema, $validSchemaThrow);
    }

    public function testGetAllFieldsExpressionItem()
    {
        $builder = new FormBuilder();

        $form = $builder->build($this->getFormJsonArray());
        $this->assertInstanceOf(Form::class, $form);
        $this->assertCount(1, $form->getAllFieldsExpressionItem());
    }

    public function testObjectValue()
    {
        $builder = new FormBuilder();

        $form = $builder->build(json_decode(
            <<<'JSON'
{
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
JSON,
            true
        ));
        $this->assertInstanceOf(Form::class, $form);
        $result = $form->getKeyValue(check: true, execExpression: false);
        $this->assertEquals(['var1' => null], $result);
    }

    public function testEmptyInputExpression()
    {
        $builder = new FormBuilder();

        $form = $builder->build(json_decode(
            <<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": null,
    "description": null,
    "required": [
        "files"
    ],
    "value": null,
    "items": null,
    "properties": {
        "files": {
            "type": "array",
            "items": {
                "type": "string",
                "title": "",
                "description": "",
                "value": null,
                "encryption": false
            },
            "properties": {},
            "title": "",
            "description": "",
            "value": {
                "type": "expression",
                "const_value": [],
                "expression_value": [
                    {
                        "type": "input",
                        "uniqueId": "653147481999151105",
                        "value": ""
                    },
                    {
                        "type": "fields",
                        "uniqueId": "653147489624395776",
                        "value": "520872893193809920.files"
                    }
                ]
            },
            "encryption": false
        }
    }
}
JSON,
            true
        ));
        $this->assertInstanceOf(Form::class, $form);
        $files = [1, 2, 3];
        $result = $form->getKeyValue(expressionSourceData: ['520872893193809920' => ['files' => $files]], check: true);
        $this->assertEquals(['files' => $files], $result);
    }

    public function testEmptyInputExpression2()
    {
        $builder = new FormBuilder();

        $form = $builder->build(json_decode(
            <<<'JSON'
{
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
            "type": "string",
            "items": null,
            "title": "变量名",
            "value": {
                "type": "const",
                "expression_value": [],
                "const_value": [
                    {
                        "type": "input",
                        "uniqueId": "653147481999151105",
                        "value": ""
                    },
                    {
                        "type": "input",
                        "uniqueId": "653147481999151105",
                        "value": "  112"
                    },
                    {
                        "type": "input",
                        "uniqueId": "653147481999151105",
                        "value": "  "
                    },
                    {
                        "type": "input",
                        "uniqueId": "653147481999151105",
                        "value": ""
                    }
                ]
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
JSON,
            true
        ));
        $this->assertInstanceOf(Form::class, $form);
        $result = $form->getKeyValue(check: true);
        $this->assertEquals(['var1' => '  112  '], $result);
    }

    public function testRequired()
    {
        $builder = new FormBuilder();

        $form = $builder->build(json_decode(
            <<<'JSON'
         {
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
                                    "type": "string",
                                    "items": null,
                                    "title": "变量名",
                                    "value": {
                                        "type": "const",
                                        "expression_value": [
                                            {
                                                "args": null,
                                                "name": "",
                                                "type": "fields",
                                                "value": "511742131687419904.field_1"
                                            }
                                        ],
                                        "const_value": [
                                            {
                                                "type": "fields",
                                                "uniqueId": "644774479133675520",
                                                "value": "511742131687419904.field_1"
                                            }
                                        ]
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
         JSON,
            true
        ));
        $this->assertInstanceOf(Form::class, $form);
        $form->getKeyValue(check: true, execExpression: false);
    }

    public function testBuildArrayRoot()
    {
        $builder = new FormBuilder();

        $form = $builder->build(json_decode(
            <<<'JSON'
         {
            "type": "object",
            "key": "root",
            "sort": 0,
            "title": "列表",
            "description": "",
            "required": null,
            "encryption": false,
            "encryption_value": null,
            "value": {
                "type": "expression",
                "const_value": [],
                "expression_value": [
                    {
                        "uniqueId": "535388129415139328",
                        "type": "fields_6597ca00724e3",
                        "value": "configs",
                        "name": "配置列表"
                    }
                ],
                "multiple_const_value": [],
                "multiple_expression_value": []
            },
            "items": null,
            "properties": null
         }
         JSON,
            true
        ));
        $this->assertInstanceOf(Form::class, $form);
        $this->assertEquals([2, 2, 3], $form->getKeyValue(['configs' => [2, 2, 3]]));

        $form = $builder->build(json_decode(
            <<<'JSON'
         {
            "type": "array",
            "key": "root",
            "sort": 0,
            "title": "列表",
            "description": "",
            "required": null,
            "encryption": false,
            "encryption_value": null,
            "value": {
                "type": "expression",
                "const_value": [],
                "expression_value": [
                    {
                        "uniqueId": "535388129415139328",
                        "type": "fields_6597ca00724e3",
                        "value": "configs",
                        "name": "配置列表"
                    }
                ],
                "multiple_const_value": [],
                "multiple_expression_value": []
            },
            "items": {
                "type": "object",
                "key": "",
                "sort": 0,
                "title": "",
                "description": "",
                "required": [],
                "value": null,
                "items": null,
                "properties": {}
            },
            "properties": null
         }
         JSON,
            true
        ));
        $this->assertInstanceOf(Form::class, $form);
        $this->assertEquals(['list' => [1, 2]], $form->getKeyValue(['configs' => ['list' => [1, 2]]]));

        $form = $builder->build(json_decode(
            <<<'JSON'
{
    "type":"array",
    "key":"root",
    "sort":0,
    "title":"列表",
    "description":"",
    "required":null,
    "value":null,
    "items":{
        "type":"object",
        "key":"",
        "sort":0,
        "title":"",
        "description":"",
        "required":null,
        "value":null,
        "items":null,
        "properties":{
            "configs":{
                "type":"array",
                "key":"configs",
                "sort":0,
                "title":"配置列表",
                "description":"",
                "required":null,
                "value":{
                    "type":"expression",
                    "const_value":null,
                    "expression_value":[
                        {
                            "uniqueId":"535388129415139328",
                            "type":"fields_6597ca00724e3",
                            "value":"configs",
                            "name":"配置列表"
                        }
                    ],
                    "multiple_const_value":null,
                    "multiple_expression_value":null
                },
                "items":{
                    "type":"object",
                    "key":"",
                    "sort":0,
                    "title":"",
                    "description":"",
                    "required":null,
                    "value":null,
                    "items":null,
                    "properties":null
                },
                "properties":null
            }
        }
    },
    "properties":{
        "0":{
            "type":"object",
            "key":"",
            "sort":0,
            "title":"",
            "description":"",
            "required":null,
            "value":null,
            "items":null,
            "properties":{
                "configs":{
                    "type":"array",
                    "key":"configs",
                    "sort":0,
                    "title":"配置列表",
                    "description":"",
                    "required":null,
                    "value":{
                        "type":"expression",
                        "const_value":null,
                        "expression_value":[
                            {
                                "uniqueId":"535388129415139328",
                                "type":"fields_6597ca00724e3",
                                "value":"configs1",
                                "name":"配置列表"
                            }
                        ],
                        "multiple_const_value":null,
                        "multiple_expression_value":null
                    },
                    "items":{
                        "type":"object",
                        "key":"",
                        "sort":0,
                        "title":"",
                        "description":"",
                        "required":null,
                        "value":null,
                        "items":null,
                        "properties":null
                    },
                    "properties":null
                }
            }
        },
        "1":{
            "type":"object",
            "key":"",
            "sort":0,
            "title":"",
            "description":"",
            "required":null,
            "value":null,
            "items":null,
            "properties":{
                "configs":{
                    "type":"array",
                    "key":"configs",
                    "sort":0,
                    "title":"配置列表",
                    "description":"",
                    "required":null,
                    "value":{
                        "type":"expression",
                        "const_value":null,
                        "expression_value":[
                            {
                                "uniqueId":"535388129415139328",
                                "type":"fields_6597ca00724e3",
                                "value":"configs2",
                                "name":"配置列表"
                            }
                        ],
                        "multiple_const_value":null,
                        "multiple_expression_value":null
                    },
                    "items":{
                        "type":"object",
                        "key":"",
                        "sort":0,
                        "title":"",
                        "description":"",
                        "required":null,
                        "value":null,
                        "items":null,
                        "properties":null
                    },
                    "properties":null
                }
            }
        }
    }
}
JSON,
            true
        ));
        $this->assertInstanceOf(Form::class, $form);
        $this->assertEquals([['configs' => [1, 1, 1]], ['configs' => [2, 2, 2]]], $form->getKeyValue(['configs1' => [1, 1, 1], 'configs2' => [2, 2, 2]]));
    }

    public function testBuildExpression()
    {
        $builder = new FormBuilder();

        $form = $builder->build(json_decode(
            <<<'JSON'
{
    "key":"root",
    "type":"object",
    "properties":{
        "remark":{
            "type":"expression",
            "value":{
                "type":"expression",
                "const_value": null,
                "expression_value":[
                    {
                        "uniqueId":"534651465730363392",
                        "type":"fields_65951bef96b15",
                        "value":"remark",
                        "name":"info.备注"
                    }
                ]
            },
            "title":"备注信息",
            "description":""
        }
   }
}
JSON,
            true
        ));
        $this->assertInstanceOf(Form::class, $form);
        $this->assertEquals(['remark' => '123'], $form->getKeyValue(['remark' => '123']));
    }

    public function testAppendConstValue()
    {
        $form = $this->builder->build($this->getFormJsonArray());
        $result = [
            'string_key' => '123',
            'number_key' => '9.99',
            'boolean_key' => false,
            'integer_key' => 123456,
            'object_key' => [
                'object_key_child_string' => 'object_key_child_string_value1',
                'object_array_expression' => null,
                'object_array_const' => [
                    '嘻嘻2',
                    '嘿嘿2',
                    '哈哈2',
                ],
                'object_object' => [
                    'object_object_key1' => 'object_object_key1_value2',
                ],
            ],
            'array_key' => [
                [
                    'array_key_child1' => 'array_key_child1_value——1112',
                    'array_array' => [
                        'array_array_value_111——1112',
                        'array_array_value_111——1113',
                    ],
                    'array_object' => [
                        'array_object_key1' => 'array_object_value_32',
                    ],
                ],
            ],
        ];
        $form->appendConstValue($result);
        $this->assertEquals($result, $form->getKeyValue(execExpression: false));
    }

    public function testAppendConstValue2()
    {
        $form = $this->builder->build(json_decode(<<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": null,
    "description": null,
    "required": [
        "data"
    ],
    "value": null,
    "encryption": false,
    "encryption_value": null,
    "items": null,
    "properties": {
        "data": {
            "type": "object",
            "properties": {
                "details": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "title": "",
                        "description": "",
                        "value": null,
                        "encryption": false,
                        "properties": {}
                    },
                    "properties": {
                        "0": {
                            "type": "object",
                            "title": "",
                            "description": "",
                            "value": null,
                            "encryption": false,
                            "properties": {
                                "sku": {
                                    "type": "string",
                                    "title": "",
                                    "description": "",
                                    "value": null,
                                    "encryption": false
                                },
                                "qty": {
                                    "type": "string",
                                    "title": "",
                                    "description": "",
                                    "value": null,
                                    "encryption": false
                                }
                            },
                            "required": [
                                "sku",
                                "qty"
                            ]
                        }
                    },
                    "title": "",
                    "description": "",
                    "value": null,
                    "encryption": false,
                    "required": [
                        "0"
                    ]
                }
            },
            "required": [
                "details"
            ],
            "title": "",
            "description": "",
            "value": null,
            "encryption": false
        }
    }
}
JSON, true));
        $data = [
            'data' => [
                'details' => [
                    [
                        'sku' => 'SKU123',
                        'qty' => '123',
                    ],
                    [
                        'sku' => 'SKU456',
                        'qty' => '456',
                    ],
                    [
                        'sku' => 'SKU789',
                        'qty' => '789',
                    ],
                    [
                        'sku' => 'SKU000',
                        'qty' => '000',
                    ],
                ],
            ],
        ];
        $form->appendConstValue($data);
        $responseResult = $form->getKeyValue(check: true);
        $this->assertEquals($data, $responseResult);
    }

    public function testGetKeyValue()
    {
        $form = $this->builder->build($this->getFormJsonArray());
        $result = [
            'string_key' => 'string_key_value',
            'number_key' => '9.9',
            'boolean_key' => true,
            'integer_key' => '0',
            'object_key' => [
                'object_key_child_string' => 'object_key_child_string_value',
                'object_array_expression' => [
                    '哈哈',
                ],
                'object_array_const' => [
                    '嘻嘻',
                    '嘿嘿',
                ],
                'object_object' => [
                    'object_object_key1' => 'object_object_key1_value',
                ],
            ],
            'array_key' => [
                [
                    'array_key_child1' => 'array_key_child1_value——111',
                    'array_array' => [
                        'array_array_value_111——111',
                    ],
                    'array_object' => [
                        'array_object_key1' => 'array_object_value_3',
                    ],
                ],
            ],
        ];
        $this->assertEquals($result, $form->getKeyValue(['object_array_expression' => ['哈哈']], true));
        $this->assertEquals([
            'string_key' => 'string_key_value',
            'number_key' => '9.9',
            'boolean_key' => true,
            'integer_key' => '0',
            'object_key' => [
                'object_key_child_string' => 'object_key_child_string_value',
                'object_array_expression' => null,
                'object_array_const' => [
                    '嘻嘻',
                    '嘿嘿',
                ],
                'object_object' => [
                    'object_object_key1' => 'object_object_key1_value',
                ],
            ],
            'array_key' => [
                [
                    'array_key_child1' => 'array_key_child1_value——111',
                    'array_array' => [
                        'array_array_value_111——111',
                    ],
                    'array_object' => [
                        'array_object_key1' => 'array_object_value_3',
                    ],
                ],
            ],
        ], $form->getKeyValue(execExpression: false));

        $form = $this->builder->build($this->getFormJsonArray2());
        $result = [
            [
                'array_key_child1' => 'array_key_child1_value——111',
                'array_array' => [
                    'array_array_value_111——111',
                ],
                'array_object' => [
                    'array_object_key1' => 'array_object_value_3',
                ],
            ],
        ];
        $this->assertEquals($result, $form->getKeyValue(['object_array_expression' => ['哈哈']], true));
    }

    public function testGeyKeyValueSourceData()
    {
        $array = json_decode(
            <<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": "root节点",
    "description": "desc",
    "items": null,
    "value": null,
    "required": [
        "string_key",
        "string_key2",
        "object_key"
    ],
    "properties": {
        "string_key": {
            "type": "string",
            "key": "string_key",
            "sort": 0,
            "title": "数据类型为string",
            "description": "desc",
            "items": null,
            "properties": null,
            "required": null,
            "encryption": false,
            "encryption_value": null,

            "value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "string_key_value",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            }
        },
        "string_key2": {
            "type": "string",
            "key": "string_key2",
            "sort": 1,
            "title": "数据类型为string2",
            "description": "desc",
            "items": null,
            "properties": null,
            "required": null,
            "encryption": false,
            "encryption_value": null,

            "value": {
                "type": "expression",
                "const_value": null,
                "expression_value": [
                     {
                        "type":"fields",
                        "value":"component-9527.string_key",
                        "name":"name",
                        "args":null
                     }
                ]
            }
        },
        "object_key": {
            "type": "object",
            "key": "object_key",
            "sort": 2,
            "title": "数据类型为object",
            "description": "desc",
            "required": [
                "object_key_child_string",
                "object_array",
                "object_object"
            ],
            "items": null,
            "value": null,
            "properties": {
                "object_key_child_string": {
                    "type": "string",
                    "key": "object_key_child_string",
                    "sort": 0,
                    "title": "数据类型为object下的child_string",
                    "description": "desc",
                    "items": null,
                    "properties": null,
                    "required": null,
                    "encryption": false,
            "encryption_value": null,

                    "value": {
                        "type": "const",
                        "const_value": [
                            {
                                "type": "input",
                                "value": "object_key_child_string_value",
                                "name": "name",
                                "args": null
                            }
                        ],
                        "expression_value": null
                    }
                },
                "object_key_child_string2": {
                    "type": "string",
                    "key": "object_key_child_string2",
                    "sort": 0,
                    "title": "数据类型为object下的child_string2",
                    "description": "desc",
                    "items": null,
                    "properties": null,
                    "required": null,
                    "encryption": false,
            "encryption_value": null,

                    "value": {
                        "type": "expression",
                        "const_value": null,
                        "expression_value": [
                            {
                                "type":"fields",
                                "value":"component-9527.object_key.object_key_child_string",
                                "name":"name",
                                "args":null
                             }
                        ]
                    }
                }
            }
        }
    }
}
JSON,
            true
        );
        $form = $this->builder->build($array);
        $form->setComponentId('component-9527');
        $this->assertEquals([
            'string_key' => 'string_key_value',
            'string_key2' => 'string_key_value',
            'object_key' => [
                'object_key_child_string' => 'object_key_child_string_value',
                'object_key_child_string2' => 'object_key_child_string_value',
            ],
        ], $form->getKeyValue());
    }

    public function testGetTileList()
    {
        $form = $this->builder->build($this->getFormJsonArray());
        $result = [
            'string_key' => '数据类型为string',
            'number_key' => '数据类型为number',
            'boolean_key' => '数据类型为boolean',
            'integer_key' => '数据类型为integer',
            'object_key' => '数据类型为object',
            'object_key.object_key_child_string' => '数据类型为object.数据类型为object下的child_string',
            'object_key.object_array_expression' => '数据类型为object.对象下的数组',
            'object_key.object_array_const' => '数据类型为object.对象下的数组',
            'object_key.object_object' => '数据类型为object.对象下的对象',
            'object_key.object_object.object_object_key1' => '数据类型为object.对象下的对象.对象下的对象1',
            'array_key' => '数据类型为array',
            'array_key[0].array_key_child1' => '数据类型为array[0].数据类型为array下的child_object_string',
            'array_key[0].array_array' => '数据类型为array[0].数组下的数组',
            'array_key[0].array_object' => '数据类型为array[0].数组下的对象',
            'array_key[0].array_object.array_object_key1' => '数据类型为array[0].数组下的对象.数组下的对象1',
        ];
        $this->assertEquals($result, $form->getTileList());

        $form = $this->builder->build($this->getFormJsonArray2());
        $result = [
            'root' => '数据类型为array',
            'root[0].array_key_child1' => '数据类型为array[0].数据类型为array下的child_object_string',
            'root[0].array_array' => '数据类型为array[0].数组下的数组',
            'root[0].array_object' => '数据类型为array[0].数组下的对象',
            'root[0].array_object.array_object_key1' => '数据类型为array[0].数组下的对象.数组下的对象1',
        ];
        $this->assertEquals($result, $form->getTileList());
    }

    public function testGetKeyNamesDataSource()
    {
        $form = $this->builder->build($this->getFormJsonArray());
        $form->setComponentId('9527');

        $children = [
            [
                'label' => '数据类型为string',
                'value' => '9527.string_key',
            ],
            [
                'label' => '数据类型为number',
                'value' => '9527.number_key',
            ],
            [
                'label' => '数据类型为boolean',
                'value' => '9527.boolean_key',
            ],
            [
                'label' => '数据类型为integer',
                'value' => '9527.integer_key',
            ],
            [
                'label' => '数据类型为object',
                'value' => '9527.object_key',
            ],
            [
                'label' => '数据类型为object.数据类型为object下的child_string',
                'value' => '9527.object_key.object_key_child_string',
            ],
            [
                'label' => '数据类型为object.对象下的数组',
                'value' => '9527.object_key.object_array_expression',
            ],
            [
                'label' => '数据类型为object.对象下的数组',
                'value' => '9527.object_key.object_array_const',
            ],
            [
                'label' => '数据类型为object.对象下的对象',
                'value' => '9527.object_key.object_object',
            ],
            [
                'label' => '数据类型为object.对象下的对象.对象下的对象1',
                'value' => '9527.object_key.object_object.object_object_key1',
            ],
            [
                'label' => '数据类型为array',
                'value' => '9527.array_key',
            ],
            [
                'label' => '数据类型为array[0].数据类型为array下的child_object_string',
                'value' => '9527.array_key[0].array_key_child1',
            ],
            [
                'label' => '数据类型为array[0].数组下的数组',
                'value' => '9527.array_key[0].array_array',
            ],
            [
                'label' => '数据类型为array[0].数组下的对象',
                'value' => '9527.array_key[0].array_object',
            ],
            [
                'label' => '数据类型为array[0].数组下的对象.数组下的对象1',
                'value' => '9527.array_key[0].array_object.array_object_key1',
            ],
        ];

        $dataSource = $form->getKeyNamesDataSource('入参配置');
        $dataSourceArray = $dataSource->toArray();
        $this->assertEquals('入参配置', $dataSourceArray['label']);
        $this->assertEquals($children, $dataSourceArray['children']);

        $form = $this->builder->build($this->getFormJsonArray2());
        $form->setComponentId('9527');

        $children = [
            [
                'label' => '数据类型为array',
                'value' => '9527.root',
            ],
            [
                'label' => '数据类型为array[0].数据类型为array下的child_object_string',
                'value' => '9527.root[0].array_key_child1',
            ],
            [
                'label' => '数据类型为array[0].数组下的数组',
                'value' => '9527.root[0].array_array',
            ],
            [
                'label' => '数据类型为array[0].数组下的对象',
                'value' => '9527.root[0].array_object',
            ],
            [
                'label' => '数据类型为array[0].数组下的对象.数组下的对象1',
                'value' => '9527.root[0].array_object.array_object_key1',
            ],
        ];
        $dataSource = $form->getKeyNamesDataSource('入参配置2');
        $dataSourceArray = $dataSource->toArray();
        $this->assertEquals('入参配置2', $dataSourceArray['label']);
        $this->assertEquals($children, $dataSourceArray['children']);
    }

    public function testIsMatch()
    {
        $form = $this->builder->build($this->getFormJsonArray());

        $input = [
            'string_key' => 'string_key_value',
            'number_key' => '123',
            'boolean_key' => true,
            'integer_key' => 111,
            'object_key' => [
                'object_key_child_string' => 'object_key_child_string_value',
                'object_array' => [
                    'object_array_value_111',
                    'object_array_value_222',
                ],
                'object_object' => [
                    'object_object_key1' => 'object_object_key1_value',
                ],
            ],
            'array_key' => [
                [
                    'array_key_child1' => 'array_key_child1_value——111',
                    'array_key_child2' => 'array_key_child2_value——111',
                    'array_array' => [
                        'array_array_value_111——111',
                        'array_array_value_222——111',
                    ],
                    'array_object' => [
                        'array_object_key1' => 'array_object_value——111',
                    ],
                ], [
                    'array_key_child1' => 'array_key_child1_value——111',
                    'array_key_child2' => 'array_key_child2_value——111',
                    'array_array' => [
                        'array_array_value_111——111',
                        'array_array_value_222——111',
                    ],
                    'array_object' => [
                        'array_object_key1' => 'array_object_value——111',
                    ],
                ],
            ],
        ];

        $this->assertTrue($form->isMatch($input));
        $this->assertFalse($form->isMatch([]));
    }

    public function testJsonScheme2()
    {
        $json = json_decode(<<<'JSON'
{
    "id": "component-677d3b00a3807",
    "version": "1",
    "type": "form",
    "structure": {
        "type": "object",
        "key": "root",
        "sort": 0,
        "title": null,
        "description": null,
        "required": [
            "options"
        ],
        "value": null,
        "encryption": false,
        "encryption_value": null,
        "items": null,
        "properties": {
            "options": {
                "type": "array",
                "key": "options",
                "sort": 0,
                "title": "",
                "description": "配置",
                "required": null,
                "value": null,
                "encryption": false,
                "encryption_value": null,
                "items": {
                        "type": "object",
                        "key": "0",
                        "sort": 0,
                        "title": "",
                        "description": "",
                        "required": [],
                        "value": null,
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": null
                    },
                "properties": [
                    {
                        "type": "object",
                        "key": "0",
                        "sort": 0,
                        "title": "",
                        "description": "",
                        "required": [
                            "platform",
                            "limit"
                        ],
                        "value": null,
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": {
                            "platform": {
                                "type": "string",
                                "key": "platform",
                                "sort": 0,
                                "title": "",
                                "description": "平台；可选：头条、网易、微博",
                                "required": null,
                                "value": null,
                                "encryption": false,
                                "encryption_value": null,
                                "items": null,
                                "properties": null
                            },
                            "limit": {
                                "type": "string",
                                "key": "limit",
                                "sort": 1,
                                "title": "",
                                "description": "条数",
                                "required": null,
                                "value": null,
                                "encryption": false,
                                "encryption_value": null,
                                "items": null,
                                "properties": null
                            }
                        }
                    }
                ]
            }
        }
    }
}
JSON
            , true);
        $form = ComponentFactory::fastCreate($json)->getForm();
        $jsonSchema = $form->toJsonSchema();
        $this->assertEquals(
            <<<'JSON'
{
    "type": "object",
    "required": [
        "options"
    ],
    "properties": {
        "options": {
            "type": "array",
            "required": [],
            "description": "配置",
            "items": {
                "type": "object",
                "required": [
                    "platform",
                    "limit"
                ],
                "description": "",
                "properties": {
                    "platform": {
                        "type": "string",
                        "required": [],
                        "description": "平台；可选：头条、网易、微博"
                    },
                    "limit": {
                        "type": "string",
                        "required": [],
                        "description": "条数"
                    }
                }
            }
        }
    }
}
JSON
            ,
            json_encode($jsonSchema, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
        );
        $form->appendConstValue([
            'options' => [
                [
                    'platform' => '头条',
                    'limit' => '10',
                ],
                [
                    'platform' => '网易',
                    'limit' => '20',
                ],
            ],
        ]);
        $this->assertTrue(true);
    }

    public function testAppendProperties()
    {
        $form = $this->builder->build(json_decode(
            <<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": "root节点",
    "description": "desc",
    "items": null,
    "value": null,
    "required": [
        "string_key",
        "object_key"
    ],
    "properties": {
        "string_key": {
            "type": "string",
            "key": "string_key",
            "sort": 0,
            "title": "数据类型为string",
            "description": "desc",
            "items": null,
            "properties": null,
            "required": null,
            "encryption": false,
            "encryption_value": null,

            "value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "string_key_value",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            }
        },
        "object_key": {
            "type": "object",
            "key": "object_key",
            "sort": 1,
            "title": "数据类型为object",
            "description": "desc",
            "required": [
            ],
            "items": null,
            "value": null,
            "properties": null
        }
    }
}
JSON,
            true
        ));
        $input = [
            'string_key' => '123',
            'object_key' => [
                'a' => 1,
                'b' => 2,
            ],
        ];
        $form->isMatch($input, true);
        $form->appendConstValue($input);
        $this->assertEquals($input, $form->getKeyValue());
    }

    public function testAppendArray()
    {
        $form = $this->builder->build(json_decode(
            <<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": "root节点",
    "description": "desc",
    "items": null,
    "value": null,
    "encryption": false,
    "encryption_value": null,
    "required": [
        "string_key",
        "object_key"
    ],
    "properties": {
        "string_key": {
            "type": "string",
            "key": "string_key",
            "sort": 0,
            "title": "数据类型为string",
            "description": "desc",
            "items": null,
            "properties": null,
            "required": null,
            "encryption": false,
            "encryption_value": null,
            "value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "string_key_value",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            }
        },
        "array_key": {
            "type": "array",
            "key": "array_key",
            "sort": 1,
            "title": "数据类型为array",
            "description": "desc",
            "required": [
            ],
            "items": null,
            "value": null,
            "properties": null
        }
    }
}
JSON,
            true
        ));
        $input = [
            'string_key' => '123',
            'array_key' => [
                'a' => 1,
                'b' => 2,
            ],
        ];
        $form->isMatch($input, true);
        $form->appendConstValue($input);
        $this->assertEquals($input, $form->getKeyValue());
    }

    public function testToJsonSchemaArrayItemsValidationWithThrow()
    {
        // Create a form manually to test the throw behavior when items exist but are empty
        $form = new Form(
            FormType::Array,
            'root',
            0,
            'Test Array',
            'Array for testing'
        );

        // Manually set an empty object as items
        $emptyObjectItems = new Form(
            FormType::Object,
            'item',
            0,
            'Empty Item',
            'Empty object item'
        );
        // Set empty properties explicitly
        $emptyObjectItems->setProperties([]);

        $form->setItems($emptyObjectItems);

        // Should work with throw=false (skip empty items)
        $schema = $form->toJsonSchema(false);
        $this->assertEquals('array', $schema['type']);
        // Should not have items field since the object is empty
        $this->assertArrayNotHasKey('items', $schema);

        // Should throw exception with throw=true about missing items
        // (because the empty object gets filtered out, making the array appear to have no items)
        $this->expectException(FlowExprEngineException::class);
        $this->expectExceptionMessage('[root] Array type must have items');
        $form->toJsonSchema(true);
    }

    public function testExpressionIsOnlyMethod()
    {
        $builder = new ValueBuilder();

        // Test case 1: Expression with Method type as first item - should return true
        $arrayWithMethod = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": null,
    "expression_value": [
        {
            "type": "methods",
            "value": "md5",
            "name": "md5",
            "args": [
                {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "input",
                            "value": "test",
                            "name": "",
                            "args": null
                        }
                    ],
                    "expression_value": null
                }
            ]
        }
    ]
}
JSON, true);
        $valueWithMethod = $builder->build($arrayWithMethod);
        $this->assertTrue($valueWithMethod->expressionIsOnlyMethod());

        // Test case 2: Expression with Field type as first item - should return false
        $arrayWithField = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": null,
    "expression_value": [
        {
            "type": "fields",
            "value": "message",
            "name": "message",
            "args": null
        }
    ]
}
JSON, true);
        $valueWithField = $builder->build($arrayWithField);
        $this->assertFalse($valueWithField->expressionIsOnlyMethod());

        // Test case 3: Expression with Input type as first item - should return false
        $arrayWithInput = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": null,
    "expression_value": [
        {
            "type": "input",
            "value": "test input",
            "name": "",
            "args": null
        }
    ]
}
JSON, true);
        $valueWithInput = $builder->build($arrayWithInput);
        $this->assertFalse($valueWithInput->expressionIsOnlyMethod());

        // Test case 4: Const type value - should return false (not expression type)
        $arrayWithConst = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "input",
            "value": "const value",
            "name": "",
            "args": null
        }
    ],
    "expression_value": null
}
JSON, true);
        $valueWithConst = $builder->build($arrayWithConst);
        $this->assertFalse($valueWithConst->expressionIsOnlyMethod());

        // Test case 5: Expression with multiple items, first being Method - should return true
        $arrayWithMultipleItems = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": null,
    "expression_value": [
        {
            "type": "methods",
            "value": "time",
            "name": "time",
            "args": []
        },
        {
            "type": "input",
            "value": " + additional text",
            "name": "",
            "args": null
        }
    ]
}
JSON, true);
        $valueWithMultipleItems = $builder->build($arrayWithMultipleItems);
        $this->assertTrue($valueWithMultipleItems->expressionIsOnlyMethod());
    }

    public function testObjectFormWithNonArrayMethodExpressionShouldThrowError()
    {
        $valueBuilder = new ValueBuilder();

        // 创建一个object类型的form
        $form = new Form(
            type: FormType::Object,
            key: 'test_object',
            sort: 0,
            title: 'Test Object',
            description: 'Test object with method expression'
        );

        // 创建一个返回string类型的函数表达式（md5函数返回string）
        $methodExpressionData = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": null,
    "expression_value": [
        {
            "type": "methods",
            "value": "md5",
            "name": "md5",
            "args": [
                {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "input",
                            "value": "test_string",
                            "name": ""
                        }
                    ],
                    "expression_value": null
                }
            ]
        }
    ]
}
JSON, true);

        // 构建Value对象，设置DataType为Array（期望返回数组）
        $value = $valueBuilder->build($methodExpressionData);
        $value->setDataType(DataType::Array);

        // 设置value到form
        $form->setValue($value);

        // 测试：调用getKeyValue时应该抛出异常，因为md5函数返回string而不是array
        $this->expectException(FlowExprEngineException::class);
        $this->expectExceptionMessage('结果为 string，无法被转换为 array');

        $form->getKeyValue();
    }

    public function testObjectFormWithArrayMethodExpression()
    {
        $valueBuilder = new ValueBuilder();

        // 创建一个object类型的form
        $form = new Form(
            type: FormType::Object,
            key: 'test_object',
            sort: 0,
            title: 'Test Object',
            description: 'Test object with method expression'
        );

        // 创建一个返回string类型的函数表达式（md5函数返回string）
        $methodExpressionData = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": null,
    "expression_value": [
        {
            "type": "methods",
            "value": "json_decode",
            "name": "md5",
            "args": [
                {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "input",
                            "value": "{\"key\": \"value\"}",
                            "name": ""
                        }
                    ],
                    "expression_value": null
                },
                {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "input",
                            "value": "1",
                            "name": ""
                        }
                    ],
                    "expression_value": null
                }
            ]
        }
    ]
}
JSON, true);

        // 构建Value对象，设置DataType为Array（期望返回数组）
        $value = $valueBuilder->build($methodExpressionData);
        $value->setDataType(DataType::Array);

        // 设置value到form
        $form->setValue($value);

        $form->getKeyValue();
        $this->assertTrue($value->expressionIsOnlyMethod());
    }

    private function getFormJsonArray(): array
    {
        $formJson = <<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": "root节点",
    "description": "desc",
    "items": null,
    "value": null,
    "encryption": false,
    "encryption_value": null,
    "required": [
        "string_key",
        "number_key",
        "boolean_key",
        "integer_key",
        "object_key",
        "array_key"
    ],
    "properties": {
        "string_key": {
            "type": "string",
            "key": "string_key",
            "sort": 0,
            "title": "数据类型为string",
            "description": "desc",
            "items": null,
            "properties": null,
            "required": null,
            "encryption": false,
            "encryption_value": null,
            "value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "string_key_value",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            }
        },
        "number_key": {
            "type": "number",
            "key": "number_key",
            "sort": 1,
            "title": "数据类型为number",
            "description": "desc",
            "items": null,
            "properties": null,
            "required": null,
            "encryption": false,
            "encryption_value": null,
            "value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "9.9",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            }
        },
        "boolean_key": {
            "type": "boolean",
            "key": "boolean_key",
            "sort": 2,
            "title": "数据类型为boolean",
            "description": "desc",
            "items": null,
            "properties": null,
            "required": null,
            "encryption": false,
            "encryption_value": null,
            "value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "boolean_key_value",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            }
        },
        "integer_key": {
            "type": "integer",
            "key": "integer_key",
            "sort": 3,
            "title": "数据类型为integer",
            "description": "desc",
            "items": null,
            "properties": null,
            "required": null,
            "encryption": false,
            "encryption_value": null,
            "value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "integer_key_value",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            }
        },
        "object_key": {
            "type": "object",
            "key": "object_key",
            "sort": 4,
            "title": "数据类型为object",
            "description": "desc",
            "required": [
                "object_key_child_string",
                "object_array",
                "object_object"
            ],
            "items": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "properties": {
                "object_key_child_string": {
                    "type": "string",
                    "key": "object_key_child_string",
                    "sort": 0,
                    "title": "数据类型为object下的child_string",
                    "description": "desc",
                    "items": null,
                    "properties": null,
                    "required": null,
                    "encryption": false,
                    "encryption_value": null,
                    "value": {
                        "type": "const",
                        "const_value": [
                            {
                                "type": "input",
                                "value": "object_key_child_string_value",
                                "name": "name",
                                "args": null
                            }
                        ],
                        "expression_value": null
                    }
                },
                "object_array_expression": {
                    "type": "array",
                    "key": "object_array_expression",
                    "sort": 1,
                    "title": "对象下的数组",
                    "description": "desc",
                    "items": {
                        "type": "string",
                        "title": "数据类型为object下的array",
                        "description": "desc",
                        "key": "",
                        "sort": 0,
                        "items": null,
                        "properties": null,
                        "required": null,
                        "encryption": false,
                        "encryption_value": null,
                        "value": null
                    },
                    "properties": null,
                    "required": null,
                    "encryption": false,
                    "encryption_value": null,
                    "value": {
                        "type": "expression",
                        "const_value": null,
                        "expression_value": [
                            {
                                "type": "fields",
                                "value": "object_array_expression",
                                "name": "name",
                                "args": null
                            }
                        ]
                    }
                },
                "object_array_const": {
                    "type": "array",
                    "key": "object_array_const",
                    "sort": 2,
                    "title": "对象下的数组",
                    "description": "desc",
                    "items": {
                        "type": "string",
                        "title": "数据类型为object下的array",
                        "description": "desc",
                        "key": "",
                        "sort": 0,
                        "items": null,
                        "properties": null,
                        "required": null,
                        "encryption": false,
                        "encryption_value": null,
                        "value": null
                    },
                    "value": null,
                    "required": null,
                    "encryption": false,
                    "encryption_value": null,
                    "properties": {
                        "0": {
                            "type": "string",
                            "key": "0",
                            "sort": 0,
                            "title": "",
                            "description": "",
                            "items": null,
                            "properties": null,
                            "required": null,
                            "encryption": false,
                            "encryption_value": null,
                            "value": {
                                "type": "const",
                                "const_value": [
                                    {
                                        "type": "input",
                                        "value": "嘻嘻",
                                        "name": "name",
                                        "args": null
                                    }
                                ],
                                "expression_value": null
                            }
                        },
                        "1": {
                            "type": "string",
                            "key": "1",
                            "sort": 1,
                            "title": "",
                            "description": "",
                            "items": null,
                            "properties": null,
                            "required": null,
                            "encryption": false,
                            "encryption_value": null,
                            "value": {
                                "type": "const",
                                "const_value": [
                                    {
                                        "type": "input",
                                        "value": "嘿嘿",
                                        "name": "name",
                                        "args": null
                                    }
                                ],
                                "expression_value": null
                            }
                        }
                    }
                },
                "object_object": {
                    "type": "object",
                    "key": "object_object",
                    "sort": 3,
                    "title": "对象下的对象",
                    "description": "desc",
                    "items": null,
                    "encryption": false,
                    "encryption_value": null,
                    "value": null,
                    "required": [
                        "object_object_key1"
                    ],
                    "properties": {
                        "object_object_key1": {
                            "type": "string",
                            "key": "object_object_key1",
                            "sort": 0,
                            "title": "对象下的对象1",
                            "description": "desc",
                            "items": null,
                            "properties": null,
                            "required": null,
                            "encryption": false,
                            "encryption_value": null,
                            "value": {
                                "type": "const",
                                "const_value": [
                                    {
                                        "type": "input",
                                        "value": "object_object_key1_value",
                                        "name": "name",
                                        "args": null
                                    }
                                ],
                                "expression_value": null
                            }
                        }
                    }
                }
            }
        },
        "array_key": {
            "type": "array",
            "key": "array_key",
            "sort": 5,
            "title": "数据类型为array",
            "description": "desc",
            "items": {
                "type": "object",
                "key": "array_key",
                "sort": 0,
                "title": "数据类型为array下的child_object",
                "description": "desc",
                "required": [
                    "array_key_child1",
                    "array_array",
                    "array_object"
                ],
                "items": null,
                "value": null,
                "encryption": false,
                "encryption_value": null,
                "properties": {
                    "array_key_child1": {
                        "type": "string",
                        "key": "array_key_child1",
                        "sort": 0,
                        "title": "数据类型为array下的child_object_string",
                        "description": "desc",
                        "items": null,
                        "properties": null,
                        "required": null,
                        "encryption": false,
                        "encryption_value": null,
                        "value": null
                    },
                    "array_array": {
                        "type": "array",
                        "key": "array_array",
                        "sort": 1,
                        "title": "数组下的数组",
                        "description": "desc",
                        "items": {
                            "type": "string",
                            "title": "数组下的数组值",
                            "description": "desc",
                            "key": "",
                            "sort": 0,
                            "items": null,
                            "properties": null,
                            "required": null,
                            "encryption": false,
                            "encryption_value": null,
                            "value": null
                        },
                        "required": null,
                        "encryption": false,
                        "encryption_value": null,
                        "properties": null,
                        "value": null
                    },
                    "array_object": {
                        "type": "object",
                        "key": "array_object",
                        "sort": 2,
                        "title": "数组下的对象",
                        "description": "desc",
                        "required": [
                            "array_object_key1"
                        ],
                        "encryption": false,
                        "encryption_value": null,
                        "items": null,
                        "properties": {
                            "array_object_key1": {
                                "type": "string",
                                "title": "数组下的对象1",
                                "description": "desc",
                                "key": "array_object_key1",
                                "sort": 0,
                                "items": null,
                                "properties": null,
                                "required": null,
                                "encryption": false,
                                "encryption_value": null,
                                "value": {
                                    "type": "const",
                                    "const_value": [
                                        {
                                            "type": "input",
                                            "value": "array_object_value",
                                            "name": "name",
                                            "args": null
                                        }
                                    ],
                                    "expression_value": null
                                }
                            }
                        },
                        "value": null
                    }
                }
            },
            "properties": {
                "0": {
                    "type": "object",
                    "key": "0",
                    "sort": 0,
                    "title": "数据类型为array下的child_object",
                    "description": "desc",
                    "required": [
                        "array_key_child1",
                        "array_array",
                        "array_object"
                    ],
                    "items": null,
                    "value": null,
                    "encryption": false,
                    "encryption_value": null,
                    "properties": {
                        "array_key_child1": {
                            "type": "string",
                            "key": "array_key_child1",
                            "sort": 0,
                            "title": "数据类型为array下的child_object_string",
                            "description": "desc",
                            "items": null,
                            "properties": null,
                            "required": null,
                            "encryption": false,
                            "encryption_value": null,
                            "value": {
                                "type": "const",
                                "const_value": [
                                    {
                                        "type": "input",
                                        "value": "array_key_child1_value——111",
                                        "name": "name",
                                        "args": null
                                    }
                                ],
                                "expression_value": null
                            }
                        },
                        "array_array": {
                            "type": "array",
                            "key": "array_array",
                            "sort": 1,
                            "title": "数组下的数组",
                            "description": "desc",
                            "value": null,
                            "required": null,
                            "encryption": false,
                            "encryption_value": null,
                            "items": {
                                "type": "string",
                                "title": "数组下的数组值",
                                "description": "desc",
                                "key": "",
                                "sort": 0,
                                "items": null,
                                "properties": null,
                                "required": null,
                                "encryption": false,
                                "encryption_value": null,
                                "value": null
                            },
                            "properties": {
                                "0": {
                                    "type": "string",
                                    "key": "0",
                                    "sort": 0,
                                    "title": "",
                                    "description": "",
                                    "items": null,
                                    "properties": null,
                                    "required": null,
                                    "encryption": false,
                                    "encryption_value": null,
                                    "value": {
                                        "type": "const",
                                        "const_value": [
                                            {
                                                "type": "input",
                                                "value": "array_array_value_111——111",
                                                "name": "name",
                                                "args": null
                                            }
                                        ],
                                        "expression_value": null
                                    }
                                }
                            }
                        },
                        "array_object": {
                            "type": "object",
                            "key": "array_object",
                            "sort": 2,
                            "title": "数组下的对象",
                            "description": "desc",
                            "required": [
                                "array_object_key1"
                            ],
                            "items": null,
                            "encryption": false,
                            "encryption_value": null,
                            "properties": {
                                "array_object_key1": {
                                    "type": "string",
                                    "title": "数组下的对象1",
                                    "description": "desc",
                                    "key": "array_object_key1",
                                    "sort": 0,
                                    "items": null,
                                    "properties": null,
                                    "required": null,
                                    "encryption": false,
                                    "encryption_value": null,
                                    "value": {
                                        "type": "const",
                                        "const_value": [
                                            {
                                                "type": "input",
                                                "value": "array_object_value_3",
                                                "name": "name",
                                                "args": null
                                            }
                                        ],
                                        "expression_value": null
                                    }
                                }
                            },
                            "value": null
                        }
                    }
                }
            },
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "required": null
        }
    }
}
JSON;
        return json_decode($formJson, true);
    }

    private function getFormJsonArray2(): array
    {
        $formJson = <<<'JSON'
{
    "type": "array",
    "key": "root",
    "sort": 0,
    "title": "数据类型为array",
    "description": "desc",
    "items": {
        "type": "object",
        "key": "array_key",
        "sort": 0,
        "title": "数据类型为array下的child_object",
        "description": "desc",
        "required": [
            "array_key_child1",
            "array_array",
            "array_object"
        ],
        "encryption": false,
        "encryption_value": null,
        "items": null,
        "value": null,
        "properties": {
            "array_key_child1": {
                "type": "string",
                "key": "array_key_child1",
                "sort": 0,
                "title": "数据类型为array下的child_object_string",
                "description": "desc",
                "items": null,
                "properties": null,
                "required": null,
                "encryption": false,
                "encryption_value": null,
                "value": null
            },
            "array_array": {
                "type": "array",
                "key": "array_array",
                "sort": 1,
                "title": "数组下的数组",
                "description": "desc",
                "items": {
                    "type": "string",
                    "title": "数组下的数组值",
                    "description": "desc",
                    "key": "",
                    "sort": 0,
                    "items": null,
                    "properties": null,
                    "required": null,
                    "encryption": false,
                    "encryption_value": null,
                    "value": null
                },
                "required": null,
                "encryption": false,
                "encryption_value": null,
                "properties": null,
                "value": null
            },
            "array_object": {
                "type": "object",
                "key": "array_object",
                "sort": 2,
                "title": "数组下的对象",
                "description": "desc",
                "required": [
                    "array_object_key1"
                ],
                "encryption": false,
                "encryption_value": null,
                "items": null,
                "properties": {
                    "array_object_key1": {
                        "type": "string",
                        "title": "数组下的对象1",
                        "description": "desc",
                        "key": "array_object_key1",
                        "sort": 0,
                        "items": null,
                        "properties": null,
                        "required": null,
                        "encryption": false,
                        "encryption_value": null,
                        "value": {
                            "type": "const",
                            "const_value": [
                                {
                                    "type": "input",
                                    "value": "array_object_value",
                                    "name": "name",
                                    "args": null
                                }
                            ],
                            "expression_value": null
                        }
                    }
                },
                "value": null
            }
        }
    },
    "properties": {
        "0": {
            "type": "object",
            "key": "0",
            "sort": 0,
            "title": "数据类型为array下的child_object",
            "description": "desc",
            "required": [
                "array_key_child1",
                "array_array",
                "array_object"
            ],
            "items": null,
            "value": null,
            "encryption": false,
            "encryption_value": null,
            "properties": {
                "array_key_child1": {
                    "type": "string",
                    "key": "array_key_child1",
                    "sort": 0,
                    "title": "数据类型为array下的child_object_string",
                    "description": "desc",
                    "items": null,
                    "properties": null,
                    "required": null,
                    "encryption": false,
                    "encryption_value": null,
                    "value": {
                        "type": "const",
                        "const_value": [
                            {
                                "type": "input",
                                "value": "array_key_child1_value——111",
                                "name": "name",
                                "args": null
                            }
                        ],
                        "expression_value": null
                    }
                },
                "array_array": {
                    "type": "array",
                    "key": "array_array",
                    "sort": 1,
                    "title": "数组下的数组",
                    "description": "desc",
                    "value": null,
                    "required": null,
                    "encryption": false,
                    "encryption_value": null,
                    "items": {
                        "type": "string",
                        "title": "数组下的数组值",
                        "description": "desc",
                        "key": "",
                        "sort": 0,
                        "items": null,
                        "properties": null,
                        "required": null,
                        "encryption": false,
                        "encryption_value": null,
                        "value": null
                    },
                    "properties": {
                        "0": {
                            "type": "string",
                            "key": "0",
                            "sort": 0,
                            "title": "",
                            "description": "",
                            "items": null,
                            "properties": null,
                            "required": null,
                            "encryption": false,
                            "encryption_value": null,
                            "value": {
                                "type": "const",
                                "const_value": [
                                    {
                                        "type": "input",
                                        "value": "array_array_value_111——111",
                                        "name": "name",
                                        "args": null
                                    }
                                ],
                                "expression_value": null
                            }
                        }
                    }
                },
                "array_object": {
                    "type": "object",
                    "key": "array_object",
                    "sort": 2,
                    "title": "数组下的对象",
                    "description": "desc",
                    "required": [
                        "array_object_key1"
                    ],
                    "encryption": false,
                    "encryption_value": null,
                    "items": null,
                    "properties": {
                        "array_object_key1": {
                            "type": "string",
                            "title": "数组下的对象1",
                            "description": "desc",
                            "key": "array_object_key1",
                            "sort": 0,
                            "items": null,
                            "properties": null,
                            "required": null,
                            "encryption": false,
                            "encryption_value": null,
                            "value": {
                                "type": "const",
                                "const_value": [
                                    {
                                        "type": "input",
                                        "value": "array_object_value_3",
                                        "name": "name",
                                        "args": null
                                    }
                                ],
                                "expression_value": null
                            }
                        }
                    },
                    "value": null
                }
            }
        }
    },
    "value": null,
    "encryption": false,
    "encryption_value": null,
    "required": null
}
JSON;
        return json_decode($formJson, true);
    }
}
