<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests\Utils;

use Dtyq\CloudFile\Kernel\Utils\StrUtil;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @coversNothing
 */
class StrUtilTest extends TestCase
{
    public function testStartsWith()
    {
        $this->assertTrue(StrUtil::startsWith('hello world', 'hello'));
        $this->assertTrue(StrUtil::startsWith('hello world', ['hi', 'hello']));
        $this->assertFalse(StrUtil::startsWith('hello world', 'world'));
        $this->assertFalse(StrUtil::startsWith('hello world', ''));
    }

    public function testEndsWith()
    {
        $this->assertTrue(StrUtil::endsWith('hello world', 'world'));
        $this->assertTrue(StrUtil::endsWith('hello world', ['earth', 'world']));
        $this->assertFalse(StrUtil::endsWith('hello world', 'hello'));
        $this->assertFalse(StrUtil::endsWith('hello world', ''));
    }

    public function testReplaceFirst()
    {
        $this->assertEquals('hi world', StrUtil::replaceFirst('hello', 'hi', 'hello world'));
        $this->assertEquals('hello world', StrUtil::replaceFirst('foo', 'bar', 'hello world'));
        $this->assertEquals('hello world', StrUtil::replaceFirst('', 'bar', 'hello world'));
        $this->assertEquals('foo world world', StrUtil::replaceFirst('hello', 'foo', 'hello world world'));
    }

    public function testReplaceLast()
    {
        $this->assertEquals('hello foo', StrUtil::replaceLast('world', 'foo', 'hello world'));
        $this->assertEquals('hello world', StrUtil::replaceLast('foo', 'bar', 'hello world'));
        $this->assertEquals('hello world', StrUtil::replaceLast('', 'bar', 'hello world'));
        $this->assertEquals('world world foo', StrUtil::replaceLast('hello', 'foo', 'world world hello'));
    }

    public function testContains()
    {
        $this->assertTrue(StrUtil::contains('hello world', 'world'));
        $this->assertTrue(StrUtil::contains('hello world', ['foo', 'world']));
        $this->assertFalse(StrUtil::contains('hello world', 'foo'));
        $this->assertTrue(StrUtil::contains('Hello World', 'world', true));
        $this->assertFalse(StrUtil::contains('Hello World', 'world', false));
    }

    public function testLimit()
    {
        $this->assertEquals('hello...', StrUtil::limit('hello world', 5));
        $this->assertEquals('hello world', StrUtil::limit('hello world', 20));
        $this->assertEquals('hello>>>', StrUtil::limit('hello world', 5, '>>>'));
    }

    public function testCamel()
    {
        $this->assertEquals('fooBar', StrUtil::camel('foo_bar'));
        $this->assertEquals('fooBar', StrUtil::camel('foo-bar'));
        $this->assertEquals('fooBar', StrUtil::camel('foo bar'));
    }

    public function testStudly()
    {
        $this->assertEquals('FooBar', StrUtil::studly('foo_bar'));
        $this->assertEquals('FooBar', StrUtil::studly('foo-bar'));
        $this->assertEquals('FooBar', StrUtil::studly('foo bar'));
    }

    public function testSnake()
    {
        $this->assertEquals('foo_bar', StrUtil::snake('fooBar'));
        $this->assertEquals('foo_bar', StrUtil::snake('FooBar'));
        $this->assertEquals('foo_bar_baz', StrUtil::snake('FooBarBaz'));
    }

    public function testKebab()
    {
        $this->assertEquals('foo-bar', StrUtil::kebab('fooBar'));
        $this->assertEquals('foo-bar', StrUtil::kebab('FooBar'));
        $this->assertEquals('foo-bar-baz', StrUtil::kebab('FooBarBaz'));
    }

    public function testRandom()
    {
        $random1 = StrUtil::random(16);
        $random2 = StrUtil::random(16);

        $this->assertEquals(16, strlen($random1));
        $this->assertEquals(16, strlen($random2));
        $this->assertNotEquals($random1, $random2);

        $random3 = StrUtil::random(32);
        $this->assertEquals(32, strlen($random3));
    }

    public function testRemovePrefix()
    {
        $this->assertEquals('world', StrUtil::removePrefix('hello ', 'hello world'));
        $this->assertEquals('hello world', StrUtil::removePrefix('foo', 'hello world'));
        $this->assertEquals('', StrUtil::removePrefix('hello', 'hello'));
    }

    public function testRemoveSuffix()
    {
        $this->assertEquals('hello', StrUtil::removeSuffix(' world', 'hello world'));
        $this->assertEquals('hello world', StrUtil::removeSuffix('foo', 'hello world'));
        $this->assertEquals('', StrUtil::removeSuffix('hello', 'hello'));
    }

    // 特殊场景测试

    public function testStartsWithEmptyString()
    {
        $this->assertFalse(StrUtil::startsWith('hello', ''));
        $this->assertFalse(StrUtil::startsWith('', ''));
    }

    public function testReplaceFirstWithMultipleOccurrences()
    {
        $result = StrUtil::replaceFirst('easy-file/', '', 'easy-file/images/test.jpg');
        $this->assertEquals('images/test.jpg', $result);

        $result2 = StrUtil::replaceFirst('easy-file/', '', 'easy-file/easy-file/test.jpg');
        $this->assertEquals('easy-file/test.jpg', $result2);
    }

    public function testChineseCharacters()
    {
        $this->assertTrue(StrUtil::startsWith('你好世界', '你好'));
        $this->assertTrue(StrUtil::endsWith('你好世界', '世界'));
        $this->assertEquals('您好世界', StrUtil::replaceFirst('你好', '您好', '你好世界'));
        $this->assertEquals('你好...', StrUtil::limit('你好世界', 2));
    }
}
