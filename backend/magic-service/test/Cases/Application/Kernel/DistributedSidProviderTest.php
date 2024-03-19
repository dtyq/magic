<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Kernel;

use Hyperf\SocketIOServer\Atomic;
use Hyperf\SocketIOServer\SidProvider\DistributedSidProvider;
use Hyperf\SocketIOServer\SocketIO;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;
use RuntimeException;

/**
 * @internal
 */
class DistributedSidProviderTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        SocketIO::$serverId = 'sid-test-server';
        SocketIO::$messageId = new Atomic();
    }

    public function testSidChangesWhenSameFdReconnects(): void
    {
        $provider = new DistributedSidProvider();
        $fd = 101;

        $firstSid = $provider->registerConnection($fd);
        $provider->unregisterConnection($fd);
        $secondSid = $provider->registerConnection($fd);

        $this->assertNotSame($firstSid, $secondSid, '同 fd 断连重连后 sid 必须变化');
        $this->assertStringStartsWith(SocketIO::$serverId . '#', $firstSid);
        $this->assertStringStartsWith(SocketIO::$serverId . '#', $secondSid);
    }

    public function testGetSidReturnsEmptyWhenFdNotRegistered(): void
    {
        $provider = new DistributedSidProvider();

        $this->assertSame('', $provider->getSid(999), '未注册 fd 时 getSid 必须返回空串，避免查询即创建');
    }

    public function testStaleSidBecomesInvalidAfterUnregister(): void
    {
        $provider = new DistributedSidProvider();
        $fd = 202;

        $sid = $provider->registerConnection($fd);
        $provider->unregisterConnection($fd);

        $this->assertFalse($provider->isLocal($sid), '断连后旧 sid 不应再视为本地活跃连接');
        $this->assertSame(-1, $provider->getFd($sid), '断连后旧 sid 反查 fd 应返回 -1');
    }

    public function testIsLocalRequiresActiveMappingAndMatchingServerId(): void
    {
        $provider = new DistributedSidProvider();
        $fd = 303;

        $sid = $provider->registerConnection($fd);
        $this->assertTrue($provider->isLocal($sid));

        $parts = explode('#', $sid, 2);
        $fakeSid = 'another-server#' . ($parts[1] ?? '');
        $this->assertFalse($provider->isLocal($fakeSid), 'serverId 不匹配时必须为非本地连接');
    }

    public function testHighFrequencyRegistrationGeneratesUniqueSid(): void
    {
        $provider = new DistributedSidProvider();
        $sids = [];

        for ($fd = 1; $fd <= 10000; ++$fd) {
            $sid = $provider->registerConnection($fd);
            $sids[$sid] = true;
        }

        $this->assertCount(10000, $sids, '高频注册下 sid 不应重复');
    }

    public function testRegisterConnectionThrowsWhenConnSeqOverflows(): void
    {
        $provider = new DistributedSidProvider();
        $seqProperty = new ReflectionProperty(DistributedSidProvider::class, 'nextConnSeq');
        $seqProperty->setAccessible(true);
        $seqProperty->setValue($provider, PHP_INT_MAX);

        try {
            $provider->registerConnection(1);
            $this->fail('预期应抛出 conn seq overflow 异常');
        } catch (RuntimeException $exception) {
            $this->assertSame('conn seq overflow', $exception->getMessage());
            $this->assertSame(DistributedSidProvider::CONN_SEQ_OVERFLOW_CODE, $exception->getCode());
        }
    }
}
