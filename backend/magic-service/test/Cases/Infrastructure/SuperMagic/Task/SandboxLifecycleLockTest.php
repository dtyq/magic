<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\SuperMagic\Task;

use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\SuperMagic\Task\Locker\SandboxLifecycleLock;
use App\Infrastructure\Util\Locker\RedisLocker;
use ArrayObject;
use Hyperf\Engine\Channel;
use Hyperf\Engine\Coroutine;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use RuntimeException;

/** @internal */
final class SandboxLifecycleLockTest extends TestCase
{
    public function testSameTopicWaitsThroughRenewalAndDifferentTopicRunsConcurrently(): void
    {
        $redis = new InMemoryLifecycleLocker();
        $lock = $this->lock($redis);
        $events = [];
        $done = new Channel(3);
        Coroutine::create(function () use ($lock, &$events, $done): void {
            $lock->run(1, function (callable $guard) use (&$events): void {
                $events[] = 'first-start';
                usleep(120000); // Longer than the fake lease: renewal must keep the second operation out.
                $guard();
                $events[] = 'first-end';
            });
            $done->push(true);
        });
        Coroutine::create(function () use ($lock, &$events, $done): void {
            $lock->run(1, function () use (&$events): void { $events[] = 'second'; });
            $done->push(true);
        });
        Coroutine::create(function () use ($lock, &$events, $done): void {
            $lock->run(2, function () use (&$events): void { $events[] = 'other-topic'; });
            $done->push(true);
        });
        for ($i = 0; $i < 3; ++$i) {
            self::assertTrue($done->pop(2));
        }
        self::assertSame(['first-start', 'other-topic', 'first-end', 'second'], $events);
        self::assertGreaterThan(5, $redis->renewCount);
        self::assertSame([], $redis->owners);
        $count = $redis->renewCount;
        usleep(30000);
        self::assertSame($count, $redis->renewCount);
    }

    public function testFailureReleasesLockWithoutReplacingOriginalException(): void
    {
        $redis = new InMemoryLifecycleLocker();
        $original = new RuntimeException('original failure');
        try {
            $this->lock($redis)->run(1, static function () use ($original): void { throw $original; });
        } catch (RuntimeException $exception) {
            self::assertSame($original, $exception);
        }
        self::assertSame([], $redis->owners);
    }

    public function testLostOwnershipStopsTheNextStage(): void
    {
        $redis = new InMemoryLifecycleLocker();
        /** @var ArrayObject<int, string> $stages */
        $stages = new ArrayObject();
        try {
            $this->lock($redis)->run(1, function (callable $guard) use ($redis, $stages): void {
                $redis->loseLease = true;
                usleep(30000);
                $guard();
                $stages[] = 'database-write';
            });
            self::fail('Expected lost ownership');
        } catch (BusinessException $exception) {
            self::assertStringContainsString('lock lost', $exception->getMessage());
        }
        self::assertCount(0, $stages);
    }

    public function testNestedOperationSharesLease(): void
    {
        $redis = new InMemoryLifecycleLocker();
        $lock = $this->lock($redis);
        self::assertSame('done', $lock->run(1, fn () => $lock->run(1, static fn () => 'done')));
        self::assertSame([], $redis->owners);
    }

    private function lock(InMemoryLifecycleLocker $redis): SandboxLifecycleLock
    {
        $factory = $this->createMock(LoggerFactory::class);
        $factory->method('get')->willReturn(new NullLogger());
        return new class($redis, $factory) extends SandboxLifecycleLock {
            protected const RENEW_INTERVAL_SECONDS = 0.01;
        };
    }
}

/** @internal */
class InMemoryLifecycleLocker extends RedisLocker
{
    public array $owners = [];

    public int $renewCount = 0;

    public bool $loseLease = false;

    public function __construct()
    {
    }

    public function spinLock(string $name, string $owner, int $expire = 10, ?int $waitTimeout = null): bool
    {
        $deadline = microtime(true) + 1;
        while (isset($this->owners[$name]) && $this->owners[$name][1] > microtime(true)) {
            if (microtime(true) > $deadline) {
                return false;
            }
            usleep(1000);
        }
        $this->owners[$name] = [$owner, microtime(true) + 0.05];
        return true;
    }

    public function renew(string $name, string $owner, int $expire): bool
    {
        ++$this->renewCount;
        if ($this->loseLease || ! isset($this->owners[$name]) || $this->owners[$name][0] !== $owner || $this->owners[$name][1] <= microtime(true)) {
            return false;
        }
        $this->owners[$name][1] = microtime(true) + 0.05;
        return true;
    }

    public function release(string $name, string $owner): bool
    {
        if (($this->owners[$name][0] ?? null) !== $owner) {
            return false;
        }
        unset($this->owners[$name]);
        return true;
    }
}
