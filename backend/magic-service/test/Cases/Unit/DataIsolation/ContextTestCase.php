<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\DataIsolation;

use App\Application\Kernel\DataIsolationInitializer;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\Infrastructure\Core\DataIsolation\DataIsolationInitializerInterface;
use App\Infrastructure\Core\DataIsolation\OrganizationInfoManagerInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use Hyperf\Context\ApplicationContext;
use Hyperf\Context\Context;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Di\Container;
use LogicException;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use ReflectionProperty;

/** 用隔离容器替代业务依赖，不启动应用或读取环境凭证。 */
abstract class ContextTestCase extends TestCase
{
    protected array $services = [];

    private ?ContainerInterface $previousContainer = null;

    /** 安装仅包含 Mock 依赖的测试容器。 */
    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturnCallback(static fn (string $key, mixed $default = null): mixed => $key === 'app_env' ? 'test' : $default);
        $this->services = [
            ConfigInterface::class => $config,
            DataIsolationInitializerInterface::class => new DataIsolationInitializer(),
            MagicOrganizationEnvDomainService::class => $this->createMock(MagicOrganizationEnvDomainService::class),
        ];
        foreach ([ThirdPlatformDataIsolationManagerInterface::class, SubscriptionManagerInterface::class, OrganizationInfoManagerInterface::class] as $interface) {
            $this->services[$interface] = $this->createMock($interface);
        }
        $container = $this->createMock(Container::class);
        $resolve = function (string $id): mixed {
            return $this->services[$id] ?? throw new LogicException('未注册测试依赖：' . $id);
        };
        $container->method('has')->willReturnCallback(fn (string $id): bool => array_key_exists($id, $this->services));
        $container->method('get')->willReturnCallback($resolve);
        $container->method('make')->willReturnCallback($resolve);
        ApplicationContext::setContainer($container);
        Context::destroy('LastBaseDataIsolationInitEnv');
        Context::destroy('DataIsolationEnvironmentCache');
        Context::destroy('DataIsolationInitializationState');
        Context::destroy('language');
    }

    /** 恢复容器和协程上下文，防止测试间状态泄漏。 */
    protected function tearDown(): void
    {
        Context::destroy('LastBaseDataIsolationInitEnv');
        Context::destroy('DataIsolationEnvironmentCache');
        Context::destroy('DataIsolationInitializationState');
        Context::destroy('language');
        if ($this->previousContainer !== null) {
            ApplicationContext::setContainer($this->previousContainer);
        } else {
            $property = new ReflectionProperty(ApplicationContext::class, 'container');
            $property->setValue(null, null);
        }
        $this->services = [];
        parent::tearDown();
    }

    /** 只注入当前测试使用的 Mock，避免执行服务构造器与外部依赖。 */
    protected function service(string $class, array $dependencies): object
    {
        $object = (new ReflectionClass($class))->newInstanceWithoutConstructor();
        foreach ($dependencies as $name => $dependency) {
            (new ReflectionProperty($class, $name))->setValue($object, $dependency);
        }
        return $object;
    }
}
