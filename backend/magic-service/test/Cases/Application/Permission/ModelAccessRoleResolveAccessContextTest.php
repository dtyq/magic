<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Permission;

use App\Domain\Admin\Entity\AdminGlobalSettingsEntity;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsStatus;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsType;
use App\Domain\Admin\Repository\Facade\AdminGlobalSettingsRepositoryInterface;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Permission\Entity\ModelAccessRoleEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Repository\Persistence\ModelAccessRoleRepository;
use App\Domain\Permission\Service\ModelAccessContextRequestCacheService;
use App\Domain\Permission\Service\ModelAccessRoleDomainService;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderModelQuery;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Core\DataIsolation\OrganizationInfoManagerInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use RuntimeException;

/**
 * @internal
 */
class ModelAccessRoleResolveAccessContextTest extends TestCase
{
    public function testResolveAccessContextSkipsAssignedRoleLookupWhenPermissionControlDisabled(): void
    {
        $subscriptionManager = $this->createMock(SubscriptionManagerInterface::class);
        $subscriptionManager->method('isEnabled')->willReturn(false);
        $this->setApplicationContainer($subscriptionManager);

        $repository = $this->createMock(ModelAccessRoleRepository::class);
        $settingsRepository = $this->createMock(AdminGlobalSettingsRepositoryInterface::class);
        $departmentUserDomainService = new readonly class extends MagicDepartmentUserDomainService {
            public function __construct()
            {
            }

            public function getDepartmentIdsByUserId(
                DataIsolation $dataIsolation,
                string $userId,
                bool $withAllParentIds = false
            ): array {
                throw new RuntimeException('getDepartmentIdsByUserId should not be called when permission control is disabled');
            }
        };
        $providerModelDomainService = new readonly class extends ProviderModelDomainService {
            public function __construct()
            {
            }

            public function queries(
                ProviderDataIsolation $dataIsolation,
                ProviderModelQuery $query,
                Page $page
            ): array {
                return [
                    'total' => 0,
                    'list' => [],
                ];
            }

            public function getEnableModels(
                ProviderDataIsolation $dataIsolation,
                ?Category $category = null,
                array $modelTypes = []
            ): array {
                return [
                    new class('model-a') {
                        public function __construct(private readonly string $modelId)
                        {
                        }

                        public function getModelId(): string
                        {
                            return $this->modelId;
                        }
                    },
                    new class('model-b') {
                        public function __construct(private readonly string $modelId)
                        {
                        }

                        public function getModelId(): string
                        {
                            return $this->modelId;
                        }
                    },
                ];
            }
        };

        $settingsRepository
            ->method('getSettingsByTypeAndOrganization')
            ->with(AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL, 'ORG_DISABLED')
            ->willReturn(
                (new AdminGlobalSettingsEntity())
                    ->setType(AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL)
                    ->setOrganization('ORG_DISABLED')
                    ->setStatus(AdminGlobalSettingsStatus::DISABLED)
            );
        $repository->expects($this->never())
            ->method('getUserAssignedRoles');

        $service = new ModelAccessRoleDomainService(
            $repository,
            $settingsRepository,
            $this->createMock(MagicDepartmentDomainService::class),
            $departmentUserDomainService,
            $this->createMock(MagicUserDomainService::class),
            $providerModelDomainService,
            new ModelAccessContextRequestCacheService(),
        );
        $dataIsolation = PermissionDataIsolation::create('ORG_DISABLED', 'operator');

        $context = $service->resolveAccessContext(
            $dataIsolation,
            'user-1'
        );

        $this->assertSame(PermissionControlStatus::DISABLED, $context->getPermissionControlStatus());
        $this->assertFalse($context->isRestricted());
        $this->assertSame([], $context->getDeniedModelIds());
        $this->assertSame(['model-a', 'model-b'], $context->getAccessibleModelIds());
    }

    public function testResolveAccessContextUsesRequestScopeCacheWithinSameRequest(): void
    {
        $subscriptionManager = $this->createMock(SubscriptionManagerInterface::class);
        $subscriptionManager->method('isEnabled')->willReturn(false);
        $this->setApplicationContainer($subscriptionManager);

        $repository = $this->createMock(ModelAccessRoleRepository::class);
        $settingsRepository = $this->createMock(AdminGlobalSettingsRepositoryInterface::class);
        $departmentUserCalls = 0;
        $providerGetEnableCalls = 0;
        $providerQueryCalls = 0;
        $departmentUserDomainService = $this->createDepartmentUserDomainService(
            static function (DataIsolation $dataIsolation, string $userId, bool $withAllParentIds) use (&$departmentUserCalls): array {
                ++$departmentUserCalls;
                if ($userId !== 'user-1' || ! $withAllParentIds) {
                    throw new RuntimeException('Unexpected getDepartmentIdsByUserId arguments');
                }

                return ['dep-1'];
            }
        );
        $providerModelDomainService = $this->createProviderModelDomainService(
            static function (ProviderDataIsolation $dataIsolation) use (&$providerGetEnableCalls): array {
                ++$providerGetEnableCalls;

                return [
                    new class('model-a') {
                        public function __construct(private readonly string $modelId)
                        {
                        }

                        public function getModelId(): string
                        {
                            return $this->modelId;
                        }
                    },
                    new class('model-b') {
                        public function __construct(private readonly string $modelId)
                        {
                        }

                        public function getModelId(): string
                        {
                            return $this->modelId;
                        }
                    },
                ];
            },
            static function (ProviderDataIsolation $dataIsolation, ProviderModelQuery $query, Page $page) use (&$providerQueryCalls): array {
                ++$providerQueryCalls;

                return [
                    'total' => 0,
                    'list' => [],
                ];
            }
        );

        $role = new ModelAccessRoleEntity();
        $role->setId(1);
        $role->setName('组织基线');
        $role->setOrganizationCode('ORG_CACHE');

        $settingsRepository->expects($this->once())
            ->method('getSettingsByTypeAndOrganization')
            ->with(AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL, 'ORG_CACHE')
            ->willReturn(
                (new AdminGlobalSettingsEntity())
                    ->setType(AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL)
                    ->setOrganization('ORG_CACHE')
                    ->setStatus(AdminGlobalSettingsStatus::ENABLED)
            );
        $repository->expects($this->once())
            ->method('getUserAssignedRoles')
            ->with('ORG_CACHE', 'user-1', ['dep-1'])
            ->willReturn([$role]);
        $repository->expects($this->once())
            ->method('getRoleBindingMap')
            ->with('ORG_CACHE', [1])
            ->willReturn([]);
        $repository->expects($this->once())
            ->method('getRoleDeniedModelMap')
            ->with('ORG_CACHE', [1])
            ->willReturn([
                1 => ['model-b'],
            ]);

        $service = new ModelAccessRoleDomainService(
            $repository,
            $settingsRepository,
            $this->createMock(MagicDepartmentDomainService::class),
            $departmentUserDomainService,
            $this->createMock(MagicUserDomainService::class),
            $providerModelDomainService,
            new ModelAccessContextRequestCacheService(),
        );

        $dataIsolation = PermissionDataIsolation::create('ORG_CACHE', 'operator');

        $firstContext = $service->resolveAccessContext($dataIsolation, 'user-1');
        $secondContext = $service->resolveAccessContext($dataIsolation, 'user-1');

        $this->assertSame(1, $departmentUserCalls);
        $this->assertSame(1, $providerGetEnableCalls);
        $this->assertSame(2, $providerQueryCalls);
        $this->assertSame($firstContext, $secondContext);
        $this->assertSame(['model-a'], $secondContext->getAccessibleModelIds());
    }

    public function testResolveAccessContextReadsFreshStatusAfterPermissionControlChangeWithinSameRequest(): void
    {
        $subscriptionManager = $this->createMock(SubscriptionManagerInterface::class);
        $subscriptionManager->method('isEnabled')->willReturn(false);
        $this->setApplicationContainer($subscriptionManager);

        $repository = $this->createMock(ModelAccessRoleRepository::class);
        $settingsRepository = $this->createMock(AdminGlobalSettingsRepositoryInterface::class);
        $departmentUserCalls = 0;
        $providerGetEnableCalls = 0;
        $providerQueryCalls = 0;
        $departmentUserDomainService = $this->createDepartmentUserDomainService(
            static function (DataIsolation $dataIsolation, string $userId, bool $withAllParentIds) use (&$departmentUserCalls): array {
                ++$departmentUserCalls;
                if ($userId !== 'user-1' || ! $withAllParentIds) {
                    throw new RuntimeException('Unexpected getDepartmentIdsByUserId arguments');
                }

                return [];
            }
        );
        $providerModelDomainService = $this->createProviderModelDomainService(
            static function (ProviderDataIsolation $dataIsolation) use (&$providerGetEnableCalls): array {
                ++$providerGetEnableCalls;

                return [
                    new class('model-a') {
                        public function __construct(private readonly string $modelId)
                        {
                        }

                        public function getModelId(): string
                        {
                            return $this->modelId;
                        }
                    },
                ];
            },
            static function (ProviderDataIsolation $dataIsolation, ProviderModelQuery $query, Page $page) use (&$providerQueryCalls): array {
                ++$providerQueryCalls;

                return [
                    'total' => 0,
                    'list' => [],
                ];
            }
        );

        $settingStatus = AdminGlobalSettingsStatus::DISABLED;
        $settingsRepository->expects($this->exactly(2))
            ->method('getSettingsByTypeAndOrganization')
            ->with(AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL, 'ORG_BUMP')
            ->willReturnCallback(static function () use (&$settingStatus): AdminGlobalSettingsEntity {
                return (new AdminGlobalSettingsEntity())
                    ->setType(AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL)
                    ->setOrganization('ORG_BUMP')
                    ->setStatus($settingStatus);
            });
        $settingsRepository->expects($this->once())
            ->method('updateSettings')
            ->with($this->callback(static function (AdminGlobalSettingsEntity $entity): bool {
                return $entity->getType() === AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL
                    && $entity->getOrganization() === 'ORG_BUMP'
                    && $entity->getStatus() === AdminGlobalSettingsStatus::ENABLED;
            }))
            ->willReturnCallback(static function (AdminGlobalSettingsEntity $entity) use (&$settingStatus): AdminGlobalSettingsEntity {
                $settingStatus = AdminGlobalSettingsStatus::ENABLED;
                return $entity;
            });
        $repository->expects($this->once())
            ->method('getUserAssignedRoles')
            ->with('ORG_BUMP', 'user-1', [])
            ->willReturn([]);

        $service = new ModelAccessRoleDomainService(
            $repository,
            $settingsRepository,
            $this->createMock(MagicDepartmentDomainService::class),
            $departmentUserDomainService,
            $this->createMock(MagicUserDomainService::class),
            $providerModelDomainService,
            new ModelAccessContextRequestCacheService(),
        );

        $dataIsolation = PermissionDataIsolation::create('ORG_BUMP', 'operator');

        $firstContext = $service->resolveAccessContext($dataIsolation, 'user-1');
        $service->updatePermissionControlStatus($dataIsolation, PermissionControlStatus::ENABLED);
        $secondContext = $service->resolveAccessContext($dataIsolation, 'user-1');

        $this->assertSame(1, $departmentUserCalls);
        $this->assertSame(2, $providerGetEnableCalls);
        $this->assertSame(3, $providerQueryCalls);
        $this->assertFalse($firstContext->isRestricted());
        $this->assertTrue($secondContext->isRestricted());
        $this->assertNotSame($firstContext, $secondContext);
        $this->assertSame(['model-a'], $secondContext->getAccessibleModelIds());
    }

    private function setApplicationContainer(SubscriptionManagerInterface $subscriptionManager): void
    {
        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturnCallback(static fn (string $key, mixed $default = null): mixed => match ($key) {
            'app_env' => 'testing',
            'service_provider.office_organization' => null,
            default => $default,
        });

        $container = new class($config, $this->createMock(ThirdPlatformDataIsolationManagerInterface::class), $subscriptionManager, $this->createMock(OrganizationInfoManagerInterface::class)) implements ContainerInterface {
            public function __construct(
                private ConfigInterface $config,
                private ThirdPlatformDataIsolationManagerInterface $thirdPlatformDataIsolationManager,
                private SubscriptionManagerInterface $subscriptionManager,
                private OrganizationInfoManagerInterface $organizationInfoManager,
            ) {
            }

            public function get(string $id): mixed
            {
                return match ($id) {
                    ConfigInterface::class => $this->config,
                    ThirdPlatformDataIsolationManagerInterface::class => $this->thirdPlatformDataIsolationManager,
                    SubscriptionManagerInterface::class => $this->subscriptionManager,
                    OrganizationInfoManagerInterface::class => $this->organizationInfoManager,
                    default => throw new RuntimeException("Unexpected container get: {$id}"),
                };
            }

            public function has(string $id): bool
            {
                return in_array($id, [
                    ConfigInterface::class,
                    ThirdPlatformDataIsolationManagerInterface::class,
                    SubscriptionManagerInterface::class,
                    OrganizationInfoManagerInterface::class,
                ], true);
            }

            public function make(string $name, array $parameters = []): mixed
            {
                return $this->get($name);
            }
        };

        ApplicationContext::setContainer($container);
    }

    private function createDepartmentUserDomainService(callable $resolver): MagicDepartmentUserDomainService
    {
        return new readonly class($resolver) extends MagicDepartmentUserDomainService {
            public function __construct(private mixed $resolver)
            {
            }

            public function getDepartmentIdsByUserId(
                DataIsolation $dataIsolation,
                string $userId,
                bool $withAllParentIds = false
            ): array {
                return ($this->resolver)($dataIsolation, $userId, $withAllParentIds);
            }
        };
    }

    private function createProviderModelDomainService(callable $enableModelsResolver, callable $queriesResolver): ProviderModelDomainService
    {
        return new readonly class($enableModelsResolver, $queriesResolver) extends ProviderModelDomainService {
            public function __construct(
                private mixed $enableModelsResolver,
                private mixed $queriesResolver,
            ) {
            }

            public function queries(
                ProviderDataIsolation $dataIsolation,
                ProviderModelQuery $query,
                Page $page
            ): array {
                return ($this->queriesResolver)($dataIsolation, $query, $page);
            }

            public function getEnableModels(
                ProviderDataIsolation $dataIsolation,
                ?Category $category = null,
                array $modelTypes = []
            ): array {
                return ($this->enableModelsResolver)($dataIsolation, $category, $modelTypes);
            }
        };
    }
}
