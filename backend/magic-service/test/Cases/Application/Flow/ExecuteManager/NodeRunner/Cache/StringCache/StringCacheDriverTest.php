<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Cases\Application\Flow\ExecuteManager\NodeRunner\Cache\StringCache;

use App\Application\Flow\ExecuteManager\NodeRunner\Cache\StringCache\StringCacheInterface;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use HyperfTest\Cases\Application\Flow\ExecuteManager\ExecuteManagerBaseTest;

/**
 * @internal
 */
class StringCacheDriverTest extends ExecuteManagerBaseTest
{
    private StringCacheInterface $stringCache;

    private FlowDataIsolation $flowDataIsolation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->stringCache = make(StringCacheInterface::class);
        $this->flowDataIsolation = FlowDataIsolation::create('test', 'uid');
    }

    public function testBasicSetAndGet()
    {
        $this->assertTrue($this->stringCache->set($this->flowDataIsolation, 'flowCode', 'testKey', 'testValue'));
        $this->assertEquals('testValue', $this->stringCache->get($this->flowDataIsolation, 'flowCode', 'testKey'));

        // Cleanup
        $this->stringCache->del($this->flowDataIsolation, 'flowCode', 'testKey');
    }

    public function testGetNonExistentKey()
    {
        $this->assertEquals('', $this->stringCache->get($this->flowDataIsolation, 'flowCode', 'nonExistentKey'));
        $this->assertEquals('default', $this->stringCache->get($this->flowDataIsolation, 'flowCode', 'nonExistentKey', 'default'));
    }

    public function testOverwriteExistingKey()
    {
        $this->assertTrue($this->stringCache->set($this->flowDataIsolation, 'flowCode', 'key1', 'originalValue'));
        $this->assertTrue($this->stringCache->set($this->flowDataIsolation, 'flowCode', 'key1', 'newValue'));
        $this->assertEquals('newValue', $this->stringCache->get($this->flowDataIsolation, 'flowCode', 'key1'));

        // Cleanup
        $this->stringCache->del($this->flowDataIsolation, 'flowCode', 'key1');
    }

    public function testDifferentFlowCodes()
    {
        $this->assertTrue($this->stringCache->set($this->flowDataIsolation, 'flow1', 'testKey', 'value1'));
        $this->assertTrue($this->stringCache->set($this->flowDataIsolation, 'flow2', 'testKey', 'value2'));

        $this->assertEquals('value1', $this->stringCache->get($this->flowDataIsolation, 'flow1', 'testKey'));
        $this->assertEquals('value2', $this->stringCache->get($this->flowDataIsolation, 'flow2', 'testKey'));

        // Cleanup
        $this->stringCache->del($this->flowDataIsolation, 'flow1', 'testKey');
        $this->stringCache->del($this->flowDataIsolation, 'flow2', 'testKey');
    }

    public function testSpecialCharacters()
    {
        $specialValue = 'Special value with 中文, emojis 🚀, and symbols @#$%';
        $this->assertTrue($this->stringCache->set($this->flowDataIsolation, 'flowCode', 'specialKey', $specialValue));
        $this->assertEquals($specialValue, $this->stringCache->get($this->flowDataIsolation, 'flowCode', 'specialKey'));

        // Cleanup
        $this->stringCache->del($this->flowDataIsolation, 'flowCode', 'specialKey');
    }

    public function testTTLBehavior()
    {
        // Test short TTL with expiration
        $this->assertTrue($this->stringCache->set($this->flowDataIsolation, 'flowCode', 'ttlKey', 'value', 1));
        $this->assertEquals('value', $this->stringCache->get($this->flowDataIsolation, 'flowCode', 'ttlKey'));
        sleep(2);
        $this->assertEquals('', $this->stringCache->get($this->flowDataIsolation, 'flowCode', 'ttlKey'));

        // Cleanup (though should be expired already)
        $this->stringCache->del($this->flowDataIsolation, 'flowCode', 'ttlKey');
    }

    public function testDeleteKey()
    {
        $this->assertTrue($this->stringCache->set($this->flowDataIsolation, 'flowCode', 'key2', 'value'));
        $this->assertEquals('value', $this->stringCache->get($this->flowDataIsolation, 'flowCode', 'key2'));
        $this->assertTrue($this->stringCache->del($this->flowDataIsolation, 'flowCode', 'key2'));
        $this->assertEquals('', $this->stringCache->get($this->flowDataIsolation, 'flowCode', 'key2'));

        // Cleanup (key should already be deleted, but ensure clean state)
        $this->stringCache->del($this->flowDataIsolation, 'flowCode', 'key2');
    }
}
