<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Kernel\Service;

use App\Application\Kernel\DTO\PlatformSettings;
use App\Application\Mode\Service\ModelBillingMultiplierCalculator;
use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Repository\Facade\MagicUserSettingRepositoryInterface;
use App\Domain\Kernel\Service\PlatformSettingsDomainService;
use App\Infrastructure\Util\Locker\Excpetion\LockException;
use App\Infrastructure\Util\Locker\LockerInterface;
use Closure;
use Hyperf\Context\ApplicationContext;
use Hyperf\Redis\Redis;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionProperty;
use RuntimeException;

/** 仅用模拟仓库、Redis 和互斥锁验证配置读取与交错时序。
 * @internal
 */
class PlatformSettingsDomainServiceTest extends TestCase
{
    private PlatformSettingsDomainService $service;

    private ?ContainerInterface $previousContainer;

    private array $cache = [];

    private array $writes = [];

    private array $deleted = [];

    private array $released = [];

    private MagicUserSettingEntity $stored;

    private int $reads = 0;

    private ?string $lockOwner = null;

    private bool $lockAvailable = true;

    private ?Closure $beforeAcquire = null;

    private ?Closure $onRead = null;

    /** 建立纯内存依赖，记录锁持有者和缓存写入时机。 */
    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $this->stored = new MagicUserSettingEntity();
        $this->stored->setValue($this->settings()->toArray());
        $repository = $this->createMock(MagicUserSettingRepositoryInterface::class);
        $repository->method('getGlobal')->willReturnCallback(function () {
            ++$this->reads;
            $snapshot = clone $this->stored;
            if ($this->onRead !== null) {
                ($this->onRead)();
            }
            return $snapshot;
        });
        $repository->method('saveGlobal')->willReturnCallback(function (MagicUserSettingEntity $entity) {
            $this->assertNotNull($this->lockOwner);
            return $this->stored = $entity;
        });
        $redis = $this->createMock(Redis::class);
        $redis->method('__call')->willReturnCallback(function (string $method, array $args) {
            switch ($method) {
                case 'get':
                    return $this->cache[$args[0]] ?? false;
                case 'setex':
                    $this->assertNotNull($this->lockOwner, '回填必须持有与保存相同的锁');
                    $this->writes[] = $args;
                    $this->cache[$args[0]] = $args[2];
                    return true;
                case 'del':
                    $this->deleted[] = $args[0];
                    unset($this->cache[$args[0]]);
                    return 1;
                default:
                    throw new RuntimeException('Unexpected Redis command');
            }
        });
        $locker = $this->createMock(LockerInterface::class);
        $locker->method('spinLock')->willReturnCallback(function (string $name, string $owner, int $expire, ?int $wait) {
            $this->assertSame('platform_settings_update', $name);
            $this->assertSame(180, $expire);
            $this->assertSame(3, $wait);
            $callback = $this->beforeAcquire;
            $this->beforeAcquire = null;
            if ($callback !== null) {
                $callback();
            }
            if (! $this->lockAvailable || $this->lockOwner !== null) {
                return false;
            }
            $this->lockOwner = $owner;
            return true;
        });
        $locker->method('release')->willReturnCallback(function (string $name, string $owner) {
            $this->assertSame('platform_settings_update', $name);
            $this->assertSame($this->lockOwner, $owner);
            $this->released[] = $owner;
            $this->lockOwner = null;
            return true;
        });
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->with(Redis::class)->willReturn($redis);
        ApplicationContext::setContainer($container);
        $this->service = new PlatformSettingsDomainService($repository, $redis, $locker);
    }

    /** 恢复原容器，避免模拟依赖污染其他测试。 */
    protected function tearDown(): void
    {
        (new ReflectionProperty(ApplicationContext::class, 'container'))->setValue(null, $this->previousContainer);
    }

    /** 旧 key 的关闭态不进入新缓存，回填必须有五分钟有效期。 */
    public function testLegacyCacheIsIgnoredAndRefillExpires(): void
    {
        $this->cache['magic:platform_settings_cache'] = json_encode($this->settings(false)->toArray());
        $this->assertTrue($this->service->get()->getModelBillingMultiplier()->enabled);
        $this->assertSame(1, $this->reads);
        $this->assertCount(1, $this->writes);
        $this->assertSame('magic:platform_settings_cache:v2', $this->writes[0][0]);
        $this->assertSame(300, $this->writes[0][1]);
        $this->assertCount(1, $this->released);
        $this->assertTrue($this->service->get()->getModelBillingMultiplier()->enabled);
        $this->assertSame(1, $this->reads);
        $this->assertCount(1, $this->released);
    }

    /** 等待锁时另一个请求已回填，获得锁后复查，不能再次回源覆盖。 */
    public function testCacheIsCheckedAgainAfterAcquiringLock(): void
    {
        $this->beforeAcquire = function () {
            $this->cache['magic:platform_settings_cache:v2'] = json_encode($this->settings(false)->toArray());
        };
        $this->assertFalse($this->service->get()->getModelBillingMultiplier()->enabled);
        $this->assertSame(0, $this->reads);
        $this->assertSame([], $this->writes);
        $this->assertCount(1, $this->released);
    }

    /** 缓存 miss 后、读锁取得前发生保存时，回填必须读取保存后的配置。 */
    public function testSaveBeforeRefillIsObserved(): void
    {
        $this->beforeAcquire = function () {
            $this->service->save($this->settings(false));
        };
        $this->assertFalse($this->service->get()->getModelBillingMultiplier()->enabled);
        $this->assertFalse(json_decode($this->writes[0][2], true)['model_billing_multiplier']['enabled']);
        $this->assertCount(2, $this->released);
    }

    /** 回填持锁期间写入不能抢锁，后续保存会使刚回填的缓存失效。 */
    public function testRefillAndSaveCannotInterleaveInsideTheLock(): void
    {
        $this->onRead = function () {
            $this->onRead = null;
            try {
                $this->service->save($this->settings(false));
                $this->fail('Concurrent save must not bypass the refill lock');
            } catch (LockException) {
                $this->addToAssertionCount(1);
            }
        };
        $this->assertTrue($this->service->get()->getModelBillingMultiplier()->enabled);
        $this->service->save($this->settings(false));
        $this->assertArrayNotHasKey('magic:platform_settings_cache:v2', $this->cache);
        $this->assertContains('magic:platform_settings_cache', $this->deleted);
        $this->assertContains('globalConfig:all', $this->deleted);
        $this->assertFalse($this->service->get()->getModelBillingMultiplier()->enabled);
        $this->assertCount(3, $this->released);
    }

    /** 锁等待超时仍可读取数据库，不回填也不释放其他请求的锁。 */
    public function testLockTimeoutReadsPersistedSettingsWithoutRefill(): void
    {
        $this->lockAvailable = false;
        $this->assertTrue($this->service->get()->getModelBillingMultiplier()->enabled);
        $this->assertSame(1, $this->reads);
        $this->assertSame([], $this->writes);
        $this->assertSame([], $this->released);
    }

    /** 数据库读取失败也必须释放回填锁，不留下半成品缓存。 */
    public function testReadExceptionReleasesLock(): void
    {
        $this->onRead = static fn () => throw new RuntimeException('mock read failure');
        try {
            $this->service->get();
            $this->fail('Read failure must propagate');
        } catch (RuntimeException $exception) {
            $this->assertSame('mock read failure', $exception->getMessage());
        }
        $this->assertCount(1, $this->released);
        $this->assertSame([], $this->writes);
    }

    /** 缓存缺少倍率字段或不是配置对象时回源，不能当作关闭态配置。 */
    public function testIncompleteCacheIsRebuiltFromPersistedSettings(): void
    {
        foreach (['{}', 'null', 'invalid json'] as $cache) {
            $this->cache['magic:platform_settings_cache:v2'] = $cache;
            $this->assertTrue($this->service->get()->getModelBillingMultiplier()->enabled);
        }
        $this->assertSame(3, $this->reads);
        $this->assertCount(3, $this->writes);
    }

    /** 倍率读持久化配置时无视展示缓存，覆盖手动倍率和关闭后的结果。 */
    public function testPersistedMultiplierIsIndependentOfDisabledCache(): void
    {
        $this->cache['magic:platform_settings_cache:v2'] = json_encode($this->settings(false)->toArray());
        $this->assertFalse($this->service->get()->getModelBillingMultiplier()->enabled);
        $calculator = new ModelBillingMultiplierCalculator();
        $capabilities = ['mock-auto' => ['resolved_model_id' => 'mock-leaf']];
        $this->assertSame(['mock-auto' => 1.25], $calculator->calculate($capabilities, [], $this->service->getPersisted()->getModelBillingMultiplier()));
        $this->stored->setValue($this->settings(false)->toArray());
        $this->assertSame(['mock-auto' => null], $calculator->calculate($capabilities, [], $this->service->getPersisted()->getModelBillingMultiplier()));
        $this->assertSame(2, $this->reads);
        $this->assertSame([], $this->writes);
        $this->assertSame([], $this->released);
    }

    /** 生成不含真实业务数据的完整平台配置。 */
    private function settings(bool $enabled = true): PlatformSettings
    {
        return PlatformSettings::fromArray(['model_billing_multiplier' => [
            'enabled' => $enabled,
            'currency' => 'CNY',
            'input_price' => '2',
            'output_price' => '3',
            'usd_to_cny_rate' => '6',
            'model_overrides' => [['model_id' => 'mock-auto', 'multiplier' => '1.25']],
        ]]);
    }
}
