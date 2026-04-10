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
        );

        $context = $service->resolveAccessContext($this->createAuthorization());

        $this->assertSame('enabled', $context['permission_control_status']);
        $this->assertTrue($context['is_restricted']);
        $this->assertSame(['model-a', 'model-b'], $context['accessible_model_ids']);
        $this->assertSame(['model-a' => true, 'model-b' => true], $context['accessible_model_id_map']);
    }

    public function testResolveAccessContextMarksDisabledStatusAsUnrestricted(): void
    {
        $service = $this->createService(
            defaultRole: $this->createDefaultRole(1),
            roleModelMap: [1 => ['model-a']],
            settingsEntity: (new AdminGlobalSettingsEntity())->setStatus(AdminGlobalSettingsStatus::DISABLED),
        );

        $context = $service->resolveAccessContext($this->createAuthorization());

        $this->assertSame('disabled', $context['permission_control_status']);
        $this->assertFalse($context['is_restricted']);
        $this->assertSame(['model-a'], $context['accessible_model_ids']);
        $this->assertSame([], $context['accessible_model_id_map']);
    }

    public function testResolveAccessContextMarksUninitializedStatusAsUnrestricted(): void
    {
        $service = $this->createService(defaultRole: null, roleModelMap: []);

        $context = $service->resolveAccessContext($this->createAuthorization());

        $this->assertSame('uninitialized', $context['permission_control_status']);
        $this->assertFalse($context['is_restricted']);
        $this->assertSame([], $context['accessible_model_ids']);
        $this->assertSame([], $context['accessible_model_id_map']);
    }

    public function testFilterModelEntriesOnlyKeepsAccessibleModelsWhenRestricted(): void
    {
        $service = $this->createService(
            defaultRole: $this->createDefaultRole(1),
            roleModelMap: [1 => ['model-a']],
        );

        $filtered = $service->filterModelEntries(
            $this->createAuthorization(),
            [
                ['model_id' => 'model-a'],
                ['model_id' => 'model-b'],
            ],
            static fn (array $item): string => $item['model_id']
        );

        $this->assertSame([['model_id' => 'model-a']], $filtered);
    }

    /**
     * @param array<int, list<string>> $roleModelMap
     */
    private function createService(
        ?ModelAccessRoleEntity $defaultRole,
        array $roleModelMap,
        ?AdminGlobalSettingsEntity $settingsEntity = null
    ): UserModelAccessAppService {
        $repository = $this->createMock(ModelAccessRoleRepository::class);
        $repository->method('getDefaultRole')->willReturn($defaultRole);
        $repository->method('getUserAssignedRoles')->willReturn([]);
        $repository->method('getRoleUserMap')->willReturn([]);
        $repository->method('getRoleModelMap')->willReturn($roleModelMap);
        $repository->method('getModelIdsByRoleId')->willReturnCallback(
            static fn (string $organizationCode, int $roleId): array => $roleModelMap[$roleId] ?? []
        );

        $adminGlobalSettingsRepository = $this->createMock(AdminGlobalSettingsRepositoryInterface::class);
        $adminGlobalSettingsRepository
            ->method('getSettingsByTypeAndOrganization')
            ->willReturn($settingsEntity);

        $domainService = new ModelAccessRoleDomainService(
            $repository,
            $adminGlobalSettingsRepository,
            $this->createMock(MagicUserDomainService::class),
            new ProviderModelDomainService(
                $this->createMock(ProviderModelRepositoryInterface::class),
                $this->createMock(ProviderConfigRepositoryInterface::class),
                $this->createMock(ProviderModelConfigVersionRepositoryInterface::class),
            )
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
