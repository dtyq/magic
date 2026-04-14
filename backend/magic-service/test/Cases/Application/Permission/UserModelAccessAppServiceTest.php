<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Permission;

use App\Application\Permission\Service\UserModelAccessAppService;
use App\Domain\Admin\Entity\AdminGlobalSettingsEntity;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsStatus;
use App\Domain\Admin\Repository\Facade\AdminGlobalSettingsRepositoryInterface;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Permission\Entity\ModelAccessRoleEntity;
use App\Domain\Permission\Repository\Persistence\ModelAccessRoleRepository;
use App\Domain\Permission\Service\ModelAccessRoleDomainService;
use App\Domain\Provider\Repository\Facade\ProviderConfigRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelConfigVersionRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class UserModelAccessAppServiceTest extends TestCase
{
    public function testResolveAccessContextMarksEnabledStatusAsRestricted(): void
    {
        $service = $this->createService(
            defaultRole: $this->createDefaultRole(1),
            roleModelMap: [1 => ['model-a', 'model-b', 'model-a']],
            availableModelIds: ['model-a', 'model-b', 'model-c'],
        );

        $context = $service->resolveAccessContext($this->createAuthorization());

        $this->assertSame('enabled', $context['permission_control_status']);
        $this->assertTrue($context['is_restricted']);
        $this->assertSame(['model-a', 'model-b'], $context['denied_model_ids']);
        $this->assertSame(['model-c'], $context['accessible_model_ids']);
        $this->assertSame(['model-c' => true], $context['accessible_model_id_map']);
    }

    public function testResolveAccessContextMarksDisabledStatusAsUnrestricted(): void
    {
        $service = $this->createService(
            defaultRole: $this->createDefaultRole(1),
            roleModelMap: [1 => ['model-a']],
            availableModelIds: ['model-a', 'model-b'],
            settingsEntity: (new AdminGlobalSettingsEntity())->setStatus(AdminGlobalSettingsStatus::DISABLED),
        );

        $context = $service->resolveAccessContext($this->createAuthorization());

        $this->assertSame('disabled', $context['permission_control_status']);
        $this->assertFalse($context['is_restricted']);
        $this->assertSame(['model-a'], $context['denied_model_ids']);
        $this->assertSame(['model-a', 'model-b'], $context['accessible_model_ids']);
        $this->assertSame([], $context['accessible_model_id_map']);
    }

    public function testResolveAccessContextMarksUninitializedStatusAsUnrestricted(): void
    {
        $service = $this->createService(defaultRole: null, roleModelMap: [], availableModelIds: ['model-a']);

        $context = $service->resolveAccessContext($this->createAuthorization());

        $this->assertSame('uninitialized', $context['permission_control_status']);
        $this->assertFalse($context['is_restricted']);
        $this->assertSame([], $context['denied_model_ids']);
        $this->assertSame(['model-a'], $context['accessible_model_ids']);
        $this->assertSame([], $context['accessible_model_id_map']);
    }

    public function testFilterModelEntriesOnlyKeepsAccessibleModelsWhenRestricted(): void
    {
        $service = $this->createService(
            defaultRole: $this->createDefaultRole(1),
            roleModelMap: [1 => ['model-a']],
            availableModelIds: ['model-a', 'model-b'],
        );

        $filtered = $service->filterModelEntries(
            $this->createAuthorization(),
            [
                ['model_id' => 'model-a'],
                ['model_id' => 'model-b'],
            ],
            static fn (array $item): string => $item['model_id']
        );

        $this->assertSame([['model_id' => 'model-b']], $filtered);
    }

    /**
     * @param array<int, list<string>> $roleModelMap
     * @param list<string> $availableModelIds
     */
    private function createService(
        ?ModelAccessRoleEntity $defaultRole,
        array $roleModelMap,
        array $availableModelIds,
        ?AdminGlobalSettingsEntity $settingsEntity = null
    ): UserModelAccessAppService {
        $repository = $this->createMock(ModelAccessRoleRepository::class);
        $repository->method('getDefaultRole')->willReturn($defaultRole);
        $repository->method('getUserAssignedRoles')->willReturn([]);
        $repository->method('getRoleUserMap')->willReturn([]);
        $repository->method('getRoleDeniedModelMap')->willReturn($roleModelMap);
        $repository->method('getDeniedModelIdsByRoleId')->willReturnCallback(
            static fn (string $organizationCode, int $roleId): array => $roleModelMap[$roleId] ?? []
        );

        $adminGlobalSettingsRepository = $this->createMock(AdminGlobalSettingsRepositoryInterface::class);
        $adminGlobalSettingsRepository
            ->method('getSettingsByTypeAndOrganization')
            ->willReturn($settingsEntity);

        $providerModelRepository = $this->createMock(ProviderModelRepositoryInterface::class);
        $providerModelRepository
            ->method('getEnableModelsByConfigIds')
            ->willReturn(array_map(
                static fn (string $modelId): object => new class($modelId) {
                    public function __construct(private readonly string $modelId)
                    {
                    }

                    public function getModelId(): string
                    {
                        return $this->modelId;
                    }
                },
                $availableModelIds
            ));
        $providerConfigRepository = $this->createMock(ProviderConfigRepositoryInterface::class);
        $providerConfigRepository
            ->method('getEnabledConfigIds')
            ->willReturn([1]);

        $providerModelDomainService = new ProviderModelDomainService(
            $providerModelRepository,
            $providerConfigRepository,
            $this->createMock(ProviderModelConfigVersionRepositoryInterface::class),
        );

        $domainService = new ModelAccessRoleDomainService(
            $repository,
            $adminGlobalSettingsRepository,
            $this->createMock(MagicUserDomainService::class),
            $providerModelDomainService
        );

        return new UserModelAccessAppService($domainService);
    }

    private function createAuthorization(): MagicUserAuthorization
    {
        return (new MagicUserAuthorization())
            ->setOrganizationCode('org-1')
            ->setId('user-1');
    }

    private function createDefaultRole(int $id): ModelAccessRoleEntity
    {
        $role = new ModelAccessRoleEntity();
        $role->setId($id);
        $role->setName('default');
        $role->setOrganizationCode('org-1');
        $role->setIsDefault(true);
        return $role;
    }
}
