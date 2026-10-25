<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Task\Service;

use App\Application\SuperMagic\Agent\Service\SuperMagicAgentAppService;
use App\Application\SuperMagic\Task\Service\TopicTaskAppService;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Permission\Repository\Facade\ResourceVisibilityRepositoryInterface;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Domain\SuperMagic\Agent\Entity\AgentMarketEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentVersionEntity;
use App\Domain\SuperMagic\Agent\Entity\UserAgentEntity;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentMarketRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentVersionRepositoryInterface;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentDomainService;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentMarketDomainService;
use App\Domain\SuperMagic\Agent\Service\UserAgentDomainService;
use App\ErrorCode\SuperMagicErrorCode;
use App\Infrastructure\Core\DataIsolation\OrganizationInfoManagerInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Config\Config;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Database\ConnectionInterface;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\DbConnection\Db;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use ReflectionMethod;
use ReflectionProperty;
use RuntimeException;

/**
 * These tests verify transaction orchestration, not database lock scheduling.
 * @internal
 */
final class TopicTaskAppServiceHiringTest extends TestCase
{
    private ?ContainerInterface $previousContainer;

    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
    }

    protected function tearDown(): void
    {
        (new ReflectionProperty(ApplicationContext::class, 'container'))->setValue(null, $this->previousContainer);
    }

    public function testAlreadyHiredDoesNotOpenATransactionOrInstallAgain(): void
    {
        [$service, $ownership, $market, $domain, $connection] = $this->service();
        $ownership->expects($this->once())->method('findUserAgentOwnershipByCode')->willReturn(new UserAgentEntity());
        $market->expects($this->never())->method('getPublishedByAgentCodeForUpdate');
        $domain->expects($this->never())->method('findByAgentCodeForHire');
        $connection->expects($this->never())->method('beginTransaction');
        (new ReflectionMethod(TopicTaskAppService::class, 'ensureAgentHired'))->invoke($service, $this->isolation(), 'SMA-sales');
    }

    public function testConcurrentHireObservedAfterMarketLockDoesNotInstallAgain(): void
    {
        [$service, $ownership, $market, $domain, $connection] = $this->service();
        $ownership->expects($this->exactly(2))->method('findUserAgentOwnershipByCode')->willReturnOnConsecutiveCalls(null, new UserAgentEntity());
        $market->expects($this->once())->method('getPublishedByAgentCodeForUpdate')->with('org-1', 'SMA-sales')->willReturn(new AgentMarketEntity());
        $domain->expects($this->never())->method('findByAgentCodeForHire');
        $connection->expects($this->once())->method('beginTransaction');
        $connection->expects($this->once())->method('commit');
        $connection->expects($this->never())->method('rollBack');
        (new ReflectionMethod(TopicTaskAppService::class, 'ensureAgentHired'))->invoke($service, $this->isolation(), 'SMA-sales');
    }

    public function testNewHireReusesDomainInstallationAndVisibility(): void
    {
        [$service, $ownership, $market, $domain, $connection, $visibility] = $this->service();
        $ownership->method('findUserAgentOwnershipByCode')->willReturn(null);
        $market->method('getPublishedByAgentCodeForUpdate')->willReturn(new AgentMarketEntity());
        $market->expects($this->once())->method('isMarketDiscoverableForUser')->willReturn(true);
        $domain->expects($this->once())->method('findByAgentCodeForHire')->with('SMA-sales')->willReturn(new AgentMarketEntity(['id' => 10, 'agent_code' => 'SMA-sales', 'agent_version_id' => 20, 'publisher_id' => 'publisher']));
        $domain->expects($this->once())->method('incrementInstallCount')->with(10)->willReturn(true);
        $ownership->expects($this->once())->method('saveUserAgentOwnership')->willReturnCallback(static fn ($isolation, $entity) => $entity);
        $visibility->expects($this->once())->method('listExistingPrincipalIdsByResourceAndType')->willReturn(['user-1']);
        $connection->expects($this->once())->method('commit');
        $connection->expects($this->never())->method('rollBack');
        (new ReflectionMethod(TopicTaskAppService::class, 'ensureAgentHired'))->invoke($service, $this->isolation(), 'SMA-sales');
    }

    public function testFailedInstallationRollsBackAndPreservesTheCause(): void
    {
        [$service, $ownership, $market, $domain, $connection, $visibility] = $this->service();
        $ownership->method('findUserAgentOwnershipByCode')->willReturn(null);
        $market->method('getPublishedByAgentCodeForUpdate')->willReturn(new AgentMarketEntity());
        $failure = new RuntimeException('Installation failed');
        $domain->method('findByAgentCodeForHire')->willThrowException($failure);
        $visibility->expects($this->never())->method('listExistingPrincipalIdsByResourceAndType');
        $connection->expects($this->once())->method('rollBack');
        $connection->expects($this->never())->method('commit');
        $this->expectExceptionObject($failure);
        (new ReflectionMethod(TopicTaskAppService::class, 'ensureAgentHired'))->invoke($service, $this->isolation(), 'SMA-sales');
    }

    public function testUnavailableMarketRollsBackWithoutInstalling(): void
    {
        [$service, $ownership, $market, $domain, $connection] = $this->service();
        $ownership->method('findUserAgentOwnershipByCode')->willReturn(null);
        $market->method('getPublishedByAgentCodeForUpdate')->willReturn(null);
        $domain->expects($this->never())->method('findByAgentCodeForHire');
        $connection->expects($this->once())->method('rollBack');
        $connection->expects($this->never())->method('commit');
        $this->expectExceptionCode(SuperMagicErrorCode::NotFound->value);
        (new ReflectionMethod(TopicTaskAppService::class, 'ensureAgentHired'))->invoke($service, $this->isolation(), 'SMA-sales');
    }

    public function testManualHireStillRejectsAnExistingOwnership(): void
    {
        [$service, $ownership, $market, $domain, $connection] = $this->service(manual: true);
        $ownership->method('findUserAgentOwnershipByCode')->willReturn(new UserAgentEntity());
        $market->method('getPublishedByAgentCodeForUpdate')->willReturn(new AgentMarketEntity());
        $domain->expects($this->never())->method('findByAgentCodeForHire');
        $connection->expects($this->once())->method('rollBack');
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SuperMagicErrorCode::OperationFailed->value);
        $service->hireAgent((new MagicUserAuthorization())->setId('user-1')->setOrganizationCode('org-1'), 'SMA-sales');
    }

    private function service(bool $manual = false): array
    {
        $ownership = $this->createMock(UserAgentDomainService::class);
        $market = $this->createMock(SuperMagicAgentMarketDomainService::class);
        $market->method('isMarketDiscoverableForUser')->willReturn(true);
        $domain = $this->createMock(AgentMarketRepositoryInterface::class);
        $versions = $this->createMock(AgentVersionRepositoryInterface::class);
        $versions->method('findById')->willReturn(new AgentVersionEntity(['creator' => 'publisher', 'modifier' => 'publisher', 'created_at' => '2026-10-12 10:00:00', 'updated_at' => '2026-10-12 10:00:00']));
        $employeeDomain = (new ReflectionClass(SuperMagicAgentDomainService::class))->newInstanceWithoutConstructor();
        foreach (['agentMarketRepository' => $domain, 'agentVersionRepository' => $versions, 'userAgentDomainService' => $ownership] as $property => $value) {
            (new ReflectionProperty(SuperMagicAgentDomainService::class, $property))->setValue($employeeDomain, $value);
        }
        $visibility = $this->createMock(ResourceVisibilityRepositoryInterface::class);
        $visibilityDomain = new ResourceVisibilityDomainService($visibility, $this->createMock(MagicDepartmentUserRepositoryInterface::class));
        $connection = $this->createMock(ConnectionInterface::class);
        $resolver = $this->createMock(ConnectionResolverInterface::class);
        $resolver->method('connection')->willReturn($connection);
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnCallback(static fn (string $key) => $key);
        $container = $this->createMock(\Hyperf\Contract\ContainerInterface::class);
        $managers = [];
        foreach ([ThirdPlatformDataIsolationManagerInterface::class, SubscriptionManagerInterface::class, OrganizationInfoManagerInterface::class] as $manager) {
            $managers[$manager] = $this->createMock($manager);
        }
        $container->method('make')->willReturnCallback(static fn (string $id) => $managers[$id]);
        $config = new Config(['app_env' => 'testing', 'error_message' => ['error_code_mapper' => [SuperMagicErrorCode::class => [60000, 60999]]]]);
        $db = new Db($container);
        $container->method('has')->willReturn(true);
        $container->method('get')->willReturnCallback(static fn (string $id) => match ($id) {
            ConfigInterface::class => $config,
            TranslatorInterface::class => $translator,
            ConnectionResolverInterface::class => $resolver,
            Db::class => $db,
            default => throw new RuntimeException('Unexpected dependency: ' . $id),
        });
        ApplicationContext::setContainer($container);
        if ($manual) {
            $service = $this->getMockBuilder(SuperMagicAgentAppService::class)->disableOriginalConstructor()->onlyMethods(['assertMarketDiscoverableForUser', 'createSuperMagicDataIsolation'])->getMock();
            $service->method('createSuperMagicDataIsolation')->willReturn($this->isolation());
        } else {
            $service = (new ReflectionClass(TopicTaskAppService::class))->newInstanceWithoutConstructor();
        }
        foreach (['userAgentDomainService' => $ownership, 'superMagicAgentMarketDomainService' => $market, 'superMagicAgentDomainService' => $employeeDomain, 'resourceVisibilityDomainService' => $visibilityDomain] as $property => $value) {
            (new ReflectionProperty($manual ? SuperMagicAgentAppService::class : TopicTaskAppService::class, $property))->setValue($service, $value);
        }
        return [$service, $ownership, $market, $domain, $connection, $visibility];
    }

    private function isolation(): SuperMagicAgentDataIsolation
    {
        return SuperMagicAgentDataIsolation::create('org-1', 'user-1');
    }
}
