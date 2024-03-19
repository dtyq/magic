<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use PHPSandbox\Cache\MemoryCacheItemPool;
use PHPUnit\Framework\TestCase;

/**
 * Copyright (c) The Magic , Distributed under the software license
 * @internal
 * @coversNothing
 */
class MemoryCacheItemPoolTest extends TestCase
{
    public function testGetInstance()
    {
        $this->assertSame(
            spl_object_id(MemoryCacheItemPool::getInstance()),
            spl_object_id(MemoryCacheItemPool::getInstance())
        );
    }

    public function testGetItem()
    {
        $cache = new MemoryCacheItemPool();
        $item = $cache->getItem('test-no-cache-key');
        $this->assertTrue(! $item->isHit());
        $this->assertNull($item->get());
    }

    public function testSave()
    {
        $key = 'test-save-cache-key';
        $cache = new MemoryCacheItemPool();
        $item = $cache->getItem($key);
        $this->assertTrue(! $item->isHit());
        $item->set(1);
        $cache->save($item);

        $item = $cache->getItem($key);
        $this->assertTrue($item->isHit());
        $this->assertSame(1, $item->get());
    }

    public function testDefaultLifetime()
    {
        $key = 'test-defaultLifetime-cache-key';
        $cache = new MemoryCacheItemPool(1);
        $item = $cache->getItem($key);
        $item->set(1);
        $cache->save($item);

        usleep(1010000);
        $item = $cache->getItem($key);
        $this->assertTrue(! $item->isHit());
    }

    public function testMaxLifetime()
    {
        $key = 'test-maxLifetime-cache-key';
        $cache = new MemoryCacheItemPool(0, true, 1);
        $item = $cache->getItem($key);
        $item->set(1);
        $item->expiresAfter(3);
        $cache->save($item);

        usleep(1010000);
        $item = $cache->getItem($key);
        $this->assertTrue(! $item->isHit());
    }

    public function testMaxItems()
    {
        $key = 'test-maxItems-cache-key';
        $cache = new MemoryCacheItemPool(0, true, 0, 1);
        $item = $cache->getItem($key . '1');
        $item->set(1);
        $cache->save($item);
        $this->assertTrue($cache->getItem($key . '1')->isHit());

        $item2 = $cache->getItem($key . '2');
        $item2->set(2);
        $cache->save($item2);

        $this->assertTrue(! $cache->getItem($key . '1')->isHit());
        $this->assertTrue($cache->getItem($key . '2')->isHit());
    }

    public function testClear()
    {
        $key = 'test-clear-cache-key';
        $cache = new MemoryCacheItemPool();

        for ($i = 1; $i <= 2; ++$i) {
            $item = $cache->getItem($key . $i);
            $item->set($i);
            $cache->save($item);
            $this->assertTrue($cache->getItem($key . $i)->isHit());
        }
        $cache->clear();
        for ($i = 1; $i <= 2; ++$i) {
            $this->assertTrue(! $cache->getItem($key . $i)->isHit());
        }
    }
}
