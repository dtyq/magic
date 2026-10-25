<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Support;

use App\Infrastructure\Core\DataIsolation\OrganizationInfoManagerInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Psr\Container\ContainerInterface;
use RuntimeException;

/**
 * 用替身覆盖少量 Magic Claw 依赖，其余 id 透传给先前安装的容器。
 *
 * ## 为什么需要透传
 *
 * `ApplicationContext` 的容器是**进程级单例**，而 PHPUnit 默认不隔离进程。
 * 早先的实现只把假容器 `setContainer()` 进去、从不还原，于是同一个 test
 * suite 里排在后面的每个用例都拿到一个只认识 5 个 id 的容器：
 * 任何需要解析 `Hyperf\Snowflake\IdGeneratorInterface`、`Hyperf\Di\Aop\Pipeline`
 * 之类真实服务的用例都会 `Undefined array key` 失败。症状是"单跑通过、
 * 整跑失败"，且失败集合会随执行顺序漂移——这正是最难排查的一类测试缺陷。
 *
 * 这里用两条独立措施消除它：
 *
 *   1. **透传**：假容器只拦截显式注册的少数 id，`has()` / `get()` 对其它
 *      id 一律委派给安装它时的那一个容器。因此即便本 trait 的替身泄漏到
 *      了后续用例，也不会改变任何它没打算改变的行为。
 *   2. **可还原**：`releaseClawEnvironment()` 把全局槽位恢复成安装前的容器。
 *      使用方可以在 `tearDown()` 里调用以获得完全干净的环境；不调用也不会
 *      破坏其它用例。
 */
trait MagicClawTestEnvironment
{
    /** @var null|ContainerInterface 安装替身前的容器，用于还原与透传 */
    private ?ContainerInterface $clawPreviousContainer = null;

    /**
     * 把全局容器槽位恢复成安装替身之前的那一个。
     *
     * 幂等：没有安装过替身时是空操作。建议在 `tearDown()` 中调用：
     *
     *     protected function tearDown(): void
     *     {
     *         $this->releaseClawEnvironment();
     *         parent::tearDown();
     *     }
     */
    protected function releaseClawEnvironment(): void
    {
        if ($this->clawPreviousContainer === null) {
            return;
        }

        ApplicationContext::setContainer($this->clawPreviousContainer);
        $this->clawPreviousContainer = null;
    }

    private function prepareClawEnvironment(array $extra = []): ContainerInterface
    {
        // 幂等：重复调用时以最早记录的"原始容器"为准，避免把上一个替身
        // 当成透传目标而层层套娃。
        $this->clawPreviousContainer ??= ApplicationContext::getContainer();

        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturn('Magic Claw runtime denied');
        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturnCallback(static fn ($key, $default = null) => $key === 'app_env' ? 'test' : $default);
        $services = [TranslatorInterface::class => $translator, ConfigInterface::class => $config];
        foreach ([ThirdPlatformDataIsolationManagerInterface::class,
            SubscriptionManagerInterface::class,
            OrganizationInfoManagerInterface::class] as $interface) {
            $services[$interface] = $this->createMock($interface);
        }
        $services = $extra + $services;

        $container = new class($services, $this->clawPreviousContainer) implements ContainerInterface {
            public function __construct(
                private array $services,
                private ?ContainerInterface $fallback,
            ) {
            }

            public function get(string $id): mixed
            {
                if (array_key_exists($id, $this->services)) {
                    return $this->services[$id];
                }
                if ($this->fallback !== null) {
                    return $this->fallback->get($id);
                }

                throw new RuntimeException(sprintf('Claw test container has no service "%s" and no fallback container', $id));
            }

            public function has(string $id): bool
            {
                return array_key_exists($id, $this->services)
                    || ($this->fallback !== null && $this->fallback->has($id));
            }

            public function make(string $id, array $parameters = []): mixed
            {
                return $this->get($id);
            }
        };

        ApplicationContext::setContainer($container);

        return $container;
    }
}
