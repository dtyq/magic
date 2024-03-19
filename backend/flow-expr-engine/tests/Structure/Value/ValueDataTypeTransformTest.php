<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Test\Structure\Value;

use Dtyq\FlowExprEngine\Exception\FlowExprEngineException;
use Dtyq\FlowExprEngine\Structure\Expression\ValueDataTypeTransform;
use Dtyq\FlowExprEngine\Test\BaseTestCase;
use Throwable;

/**
 * @internal
 * @coversNothing
 */
class ValueDataTypeTransformTest extends BaseTestCase
{
    public function testToNumber()
    {
        $source = '123';
        $target = ValueDataTypeTransform::toNumber($source);
        $this->assertEquals('123', $target);

        $source = '123.9900';
        $target = ValueDataTypeTransform::toNumber($source);
        $this->assertEquals('123.9900', $target);

        $source = 123;
        $target = ValueDataTypeTransform::toNumber($source);
        $this->assertEquals('123', $target);

        try {
            $source = '123你好';
            ValueDataTypeTransform::toNumber($source);
        } catch (Throwable $th) {
            $this->assertEquals('Cannot convert 123你好 to number', $th->getMessage());
            $this->assertInstanceOf(FlowExprEngineException::class, $th);
        }
    }

    public function testToString()
    {
        $target = ValueDataTypeTransform::toString('123');
        $this->assertEquals('123', $target);

        $target = ValueDataTypeTransform::toString(123);
        $this->assertEquals('123', $target);

        $target = ValueDataTypeTransform::toString(true);
        $this->assertEquals('true', $target);

        $target = ValueDataTypeTransform::toString(false);
        $this->assertEquals('false', $target);

        $target = ValueDataTypeTransform::toString(null);
        $this->assertEquals('null', $target);

        $target = ValueDataTypeTransform::toString(['a', 'b']);
        $this->assertEquals('["a","b"]', $target);

        $target = ValueDataTypeTransform::toString(['a' => 1, 'b' => 2]);
        $this->assertEquals('{"a":1,"b":2}', $target);
    }

    public function testToArray()
    {
        $source = '123';
        $target = ValueDataTypeTransform::toArray($source);
        $this->assertEquals(['123'], $target);

        $source = 123;
        $target = ValueDataTypeTransform::toArray($source);
        $this->assertEquals([123], $target);

        $target = ValueDataTypeTransform::toArray(true);
        $this->assertEquals([true], $target);

        $target = ValueDataTypeTransform::toArray(false);
        $this->assertEquals([false], $target);

        $source = null;
        $target = ValueDataTypeTransform::toArray($source);
        $this->assertEquals([null], $target);

        $source = ['a', 'b'];
        $target = ValueDataTypeTransform::toArray($source);
        $this->assertEquals(['a', 'b'], $target);

        $source = ['a' => 1, 'b' => 2];
        $target = ValueDataTypeTransform::toArray($source);
        $this->assertEquals([['a' => 1, 'b' => 2]], $target);
    }

    public function testToBoolean()
    {
        $source = '0';
        $target = ValueDataTypeTransform::toBoolean($source);
        $this->assertFalse($target);

        $source = 123;
        $target = ValueDataTypeTransform::toBoolean($source);
        $this->assertTrue($target);

        $source = 0;
        $target = ValueDataTypeTransform::toBoolean($source);
        $this->assertFalse($target);

        $target = ValueDataTypeTransform::toBoolean(true);
        $this->assertTrue($target);

        $target = ValueDataTypeTransform::toBoolean(false);
        $this->assertFalse($target);
    }

    public function testToJson()
    {
        $source = ['a', 'b'];
        $target = ValueDataTypeTransform::toJson($source);
        $this->assertEquals('["a","b"]', $target);

        $source = ['a' => 1, 'b' => 2];
        $target = ValueDataTypeTransform::toJson($source);
        $this->assertEquals('{"a":1,"b":2}', $target);
    }

    public function testCount()
    {
        $source = ['a', 'b'];
        $target = ValueDataTypeTransform::count($source);
        $this->assertEquals(2, $target);
    }

    public function testEmpty()
    {
        $source = ['a', 'b'];
        $target = ValueDataTypeTransform::empty($source);
        $this->assertFalse($target);

        $source = [];
        $target = ValueDataTypeTransform::empty($source);
        $this->assertTrue($target);
    }

    public function testJoin()
    {
        $source = ['a', 'b'];
        $target = ValueDataTypeTransform::join($source, ',');
        $this->assertEquals('a,b', $target);

        $source = [['a' => 1], ['b' => 2]];
        $target = ValueDataTypeTransform::join($source, ', ');
        $this->assertEquals('{"a":1}, {"b":2}', $target);

        $target = ValueDataTypeTransform::join($source, "\n");
        $this->assertEquals('{"a":1}
{"b":2}', $target);
    }
}
