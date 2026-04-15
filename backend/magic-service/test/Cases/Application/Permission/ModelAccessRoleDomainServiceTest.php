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
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Permission\Entity\ModelAccessRoleEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Repository\Persistence\ModelAccessRoleRepository;
use App\Domain\Permission\Service\ModelAccessRoleDomainService;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\ValueObject\Page;
use HyperfTest\HttpTestCase;
use Mockery;

/**
 * @internal
 */
class ModelAccessRoleDomainServiceTest extends HttpTestCase
{
    public function testGetMetaReturnsDisabledWhenDefaultRoleNotExists(): void
    {
        $repository = Mockery::mock(ModelAccessRoleRepository::class);
        $adminGlobalSettingsRepository = Mockery::mock(AdminGlobalSettingsRepositoryInterface::class);
        $userDomainService = Mockery::mock(MagicUserDomainService::class);
        $providerModelDomainService = di(ProviderModelDomainService::class);

        $repository->shouldReceive('getDefaultRole')
            ->once()
            ->with('ORG_META')
            ->andReturn(null);

        $service = new ModelAccessRoleDomainService($repository, $adminGlobalSettingsRepository, $userDomainService, $providerModelDomainService);

        $result = $service->getMeta(PermissionDataIsolation::create('ORG_META', 'operator'));

        $this->assertSame(PermissionControlStatus::UNINITIALIZED, $result['permission_control_status']);
        $this->assertNull($result['default_role']);
    }

    public function testGetMetaReturnsDisabledWhenGlobalSettingDisabled(): void
    {
        $repository = Mockery::mock(ModelAccessRoleRepository::class);
        $adminGlobalSettingsRepository = Mockery::mock(AdminGlobalSettingsRepositoryInterface::class);
        $userDomainService = Mockery::mock(MagicUserDomainService::class);
        $providerModelDomainService = di(ProviderModelDomainService::class);

        $defaultRole = $this->makeRole(id: 1, name: '默认角色', isDefault: true);
        $setting = (new AdminGlobalSettingsEntity())
            ->setType(AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL)
            ->setOrganization('ORG_META_DISABLED')
            ->setStatus(AdminGlobalSettingsStatus::DISABLED);

        $repository->shouldReceive('getDefaultRole')
            ->once()
            ->with('ORG_META_DISABLED')
            ->andReturn($defaultRole);
        $repository->shouldReceive('getDeniedModelIdsByRoleId')
            ->once()
            ->with('ORG_META_DISABLED', 1)
            ->andReturn(['gpt-4.1']);
        $adminGlobalSettingsRepository->shouldReceive('getSettingsByTypeAndOrganization')
            ->once()
            ->with(AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL, 'ORG_META_DISABLED')
            ->andReturn($setting);

        $service = new ModelAccessRoleDomainService($repository, $adminGlobalSettingsRepository, $userDomainService, $providerModelDomainService);

        $result = $service->getMeta(PermissionDataIsolation::create('ORG_META_DISABLED', 'operator'));

        $this->assertSame(PermissionControlStatus::DISABLED, $result['permission_control_status']);
        $this->assertSame($defaultRole, $result['default_role']);
    }

    public function testQueriesHydratesUserIdsAndDeniedModelIds(): void
    {
        $repository = Mockery::mock(ModelAccessRoleRepository::class);
        $adminGlobalSettingsRepository = Mockery::mock(AdminGlobalSettingsRepositoryInterface::class);
        $userDomainService = Mockery::mock(MagicUserDomainService::class);
        $providerModelDomainService = di(ProviderModelDomainService::class);

        $role = $this->makeRole(id: 11, name: '高级角色', isDefault: false, parentRoleId: 10);

        $repository->shouldReceive('queries')
            ->once()
            ->andReturn(['total' => 1, 'list' => [$role]]);
        $repository->shouldReceive('getRoleUserMap')
            ->once()
            ->with('ORG_QUERY', [11])
            ->andReturn([11 => ['u_001', 'u_002']]);
        $repository->shouldReceive('getRoleDeniedModelMap')
            ->once()
            ->with('ORG_QUERY', [11])
            ->andReturn([11 => ['gpt-4.1', 'claude-sonnet-4']]);

        $service = new ModelAccessRoleDomainService($repository, $adminGlobalSettingsRepository, $userDomainService, $providerModelDomainService);

        $result = $service->queries(PermissionDataIsolation::create('ORG_QUERY', 'operator'), new Page(1, 10));

        $this->assertSame(1, $result['total']);
        $this->assertCount(1, $result['list']);
        $this->assertSame(['u_001', 'u_002'], $result['list'][0]->getUserIds());
        $this->assertSame(['gpt-4.1', 'claude-sonnet-4'], $result['list'][0]->getDeniedModelIds());
    }

    public function testCreateDefaultRoleAllowsEmptyDeniedModelList(): void
    {
        $repository = Mockery::mock(ModelAccessRoleRepository::class);
        $adminGlobalSettingsRepository = Mockery::mock(AdminGlobalSettingsRepositoryInterface::class);
        $userDomainService = Mockery::mock(MagicUserDomainService::class);
        $providerModelDomainService = di(ProviderModelDomainService::class);

        $repository->shouldReceive('getByName')
            ->once()
            ->with('ORG_DEFAULT', '默认角色')
            ->andReturn(null);
        $repository->shouldReceive('getDefaultRole')
            ->once()
            ->with('ORG_DEFAULT')
            ->andReturn(null);
        $repository->shouldReceive('save')
            ->once()
            ->andReturnUsing(static function (ModelAccessRoleEntity $entity): ModelAccessRoleEntity {
                $entity->setId(1);
                return $entity;
            });
        $repository->shouldReceive('replaceDeniedModels')
            ->once()
            ->with('ORG_DEFAULT', 1, [], 'operator');
        $repository->shouldReceive('replaceUsers')
            ->once()
            ->with('ORG_DEFAULT', 1, [], 'operator');
        $repository->shouldReceive('getById')
            ->once()
            ->with('ORG_DEFAULT', 1)
            ->andReturn($this->makeRole(id: 1, name: '默认角色', isDefault: true));
        $repository->shouldReceive('getRoleUserMap')
            ->once()
            ->with('ORG_DEFAULT', [1])
            ->andReturn([]);
        $repository->shouldReceive('getRoleDeniedModelMap')
            ->once()
            ->with('ORG_DEFAULT', [1])
            ->andReturn([]);
        $adminGlobalSettingsRepository->shouldReceive('updateSettings')
            ->once()
            ->andReturnUsing(static fn (AdminGlobalSettingsEntity $entity) => $entity);

        $service = new ModelAccessRoleDomainService($repository, $adminGlobalSettingsRepository, $userDomainService, $providerModelDomainService);

        $entity = $this->makeRole(name: '默认角色', isDefault: true);
        $entity->setDeniedModelIds([]);

        $result = $service->createDefaultRole(PermissionDataIsolation::create('ORG_DEFAULT', 'operator'), $entity);

        $this->assertSame(1, $result->getId());
        $this->assertSame([], $result->getDeniedModelIds());
    }

    public function testCreateRoleRequiresDefaultRole(): void
    {
        $repository = Mockery::mock(ModelAccessRoleRepository::class);
        $adminGlobalSettingsRepository = Mockery::mock(AdminGlobalSettingsRepositoryInterface::class);
        $userDomainService = Mockery::mock(MagicUserDomainService::class);
        $providerModelDomainService = di(ProviderModelDomainService::class);

        $repository->shouldReceive('getByName')
            ->once()
            ->with('ORG_NODEFAULT', '高级角色')
            ->andReturn(null);
        $repository->shouldReceive('getDefaultRole')
            ->once()
            ->with('ORG_NODEFAULT')
            ->andReturn(null);

        $service = new ModelAccessRoleDomainService($repository, $adminGlobalSettingsRepository, $userDomainService, $providerModelDomainService);

        $entity = $this->makeRole(name: '高级角色', isDefault: false, parentRoleId: 1);

        $this->expectException(BusinessException::class);
        $service->createRole(PermissionDataIsolation::create('ORG_NODEFAULT', 'operator'), $entity);
    }

    public function testCreateRoleAllowsNoParentRole(): void
    {
        $repository = Mockery::mock(ModelAccessRoleRepository::class);
        $adminGlobalSettingsRepository = Mockery::mock(AdminGlobalSettingsRepositoryInterface::class);
        $userDomainService = Mockery::mock(MagicUserDomainService::class);
        $providerModelDomainService = di(ProviderModelDomainService::class);

        $defaultRole = $this->makeRole(id: 1, name: '默认角色', isDefault: true);

        $repository->shouldReceive('getByName')
            ->once()
            ->with('ORG_NOPARENT', '高级角色')
            ->andReturn(null);
        $repository->shouldReceive('getDefaultRole')
            ->once()
            ->with('ORG_NOPARENT')
            ->andReturn($defaultRole);
        $repository->shouldReceive('save')
            ->once()
            ->andReturnUsing(static function (ModelAccessRoleEntity $entity): ModelAccessRoleEntity {
                $entity->setId(2);
                return $entity;
            });
        $repository->shouldReceive('replaceDeniedModels')
            ->once()
            ->with('ORG_NOPARENT', 2, [], 'operator');
        $repository->shouldReceive('replaceUsers')
            ->once()
            ->with('ORG_NOPARENT', 2, [], 'operator');
        $repository->shouldReceive('getById')
            ->once()
            ->with('ORG_NOPARENT', 2)
            ->andReturn($this->makeRole(id: 2, name: '高级角色', isDefault: false, parentRoleId: null));
        $repository->shouldReceive('getRoleUserMap')
            ->once()
            ->with('ORG_NOPARENT', [2])
            ->andReturn([]);
        $repository->shouldReceive('getRoleDeniedModelMap')
            ->once()
            ->with('ORG_NOPARENT', [2])
            ->andReturn([]);

        $service = new ModelAccessRoleDomainService($repository, $adminGlobalSettingsRepository, $userDomainService, $providerModelDomainService);

        $entity = $this->makeRole(name: '高级角色', isDefault: false, parentRoleId: null);

        $result = $service->createRole(PermissionDataIsolation::create('ORG_NOPARENT', 'operator'), $entity);

        $this->assertSame(2, $result->getId());
        $this->assertNull($result->getParentRoleId());
    }

    public function testCreateRoleRejectsParentChainThatDoesNotTraceToDefault(): void
    {
        $repository = Mockery::mock(ModelAccessRoleRepository::class);
        $adminGlobalSettingsRepository = Mockery::mock(AdminGlobalSettingsRepositoryInterface::class);
        $userDomainService = Mockery::mock(MagicUserDomainService::class);
        $providerModelDomainService = di(ProviderModelDomainService::class);

        $defaultRole = $this->makeRole(id: 1, name: '默认角色', isDefault: true);
        $parentRole = $this->makeRole(id: 2, name: '父角色', isDefault: false, parentRoleId: null);

        $repository->shouldReceive('getByName')
            ->once()
            ->with('ORG_CHAIN', '高级角色')
            ->andReturn(null);
        $repository->shouldReceive('getDefaultRole')
            ->once()
            ->with('ORG_CHAIN')
            ->andReturn($defaultRole);
        $repository->shouldReceive('getById')
            ->once()
            ->with('ORG_CHAIN', 2)
            ->andReturn($parentRole);

        $service = new ModelAccessRoleDomainService($repository, $adminGlobalSettingsRepository, $userDomainService, $providerModelDomainService);

        $entity = $this->makeRole(name: '高级角色', isDefault: false, parentRoleId: 2);

        $this->expectException(BusinessException::class);
        $service->createRole(PermissionDataIsolation::create('ORG_CHAIN', 'operator'), $entity);
    }

    public function testDestroyLastDefaultRoleReturnsUninitialized(): void
    {
        $repository = Mockery::mock(ModelAccessRoleRepository::class);
        $adminGlobalSettingsRepository = Mockery::mock(AdminGlobalSettingsRepositoryInterface::class);
        $userDomainService = Mockery::mock(MagicUserDomainService::class);
        $providerModelDomainService = di(ProviderModelDomainService::class);

        $defaultRole = $this->makeRole(id: 1, name: '默认角色', isDefault: true);

        $repository->shouldReceive('getById')
            ->once()
            ->with('ORG_DELETE_LAST', 1)
            ->andReturn($defaultRole);
        $repository->shouldReceive('getRoleUserMap')
            ->once()
            ->with('ORG_DELETE_LAST', [1])
            ->andReturn([]);
        $repository->shouldReceive('getRoleDeniedModelMap')
            ->once()
            ->with('ORG_DELETE_LAST', [1])
            ->andReturn([1 => ['gpt-4.1']]);
        $repository->shouldReceive('countChildren')
            ->once()
            ->with('ORG_DELETE_LAST', 1)
            ->andReturn(0);
        $repository->shouldReceive('hasOtherRoles')
            ->once()
            ->with('ORG_DELETE_LAST', 1)
            ->andReturn(false);
        $repository->shouldReceive('replaceUsers')
            ->once()
            ->with('ORG_DELETE_LAST', 1, [], '');
        $repository->shouldReceive('replaceDeniedModels')
            ->once()
            ->with('ORG_DELETE_LAST', 1, [], '');
        $repository->shouldReceive('delete')
            ->once()
            ->with('ORG_DELETE_LAST', 1);
        $adminGlobalSettingsRepository->shouldReceive('deleteSettingsByTypeAndOrganization')
            ->once()
            ->with(AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL, 'ORG_DELETE_LAST');

        $service = new ModelAccessRoleDomainService($repository, $adminGlobalSettingsRepository, $userDomainService, $providerModelDomainService);

        $result = $service->destroy(PermissionDataIsolation::create('ORG_DELETE_LAST', 'operator'), 1);

        $this->assertSame(PermissionControlStatus::UNINITIALIZED, $result);
    }

    public function testDestroyDefaultRoleRequiresItToBeLastRole(): void
    {
        $repository = Mockery::mock(ModelAccessRoleRepository::class);
        $adminGlobalSettingsRepository = Mockery::mock(AdminGlobalSettingsRepositoryInterface::class);
        $userDomainService = Mockery::mock(MagicUserDomainService::class);
        $providerModelDomainService = di(ProviderModelDomainService::class);

        $defaultRole = $this->makeRole(id: 1, name: '默认角色', isDefault: true);

        $repository->shouldReceive('getById')
            ->once()
            ->with('ORG_DELETE', 1)
            ->andReturn($defaultRole);
        $repository->shouldReceive('getRoleUserMap')
            ->once()
            ->with('ORG_DELETE', [1])
            ->andReturn([]);
        $repository->shouldReceive('getRoleDeniedModelMap')
            ->once()
            ->with('ORG_DELETE', [1])
            ->andReturn([1 => ['gpt-4.1']]);
        $repository->shouldReceive('countChildren')
            ->once()
            ->with('ORG_DELETE', 1)
            ->andReturn(0);
        $repository->shouldReceive('hasOtherRoles')
            ->once()
            ->with('ORG_DELETE', 1)
            ->andReturn(true);

        $service = new ModelAccessRoleDomainService($repository, $adminGlobalSettingsRepository, $userDomainService, $providerModelDomainService);

        $this->expectException(BusinessException::class);
        $service->destroy(PermissionDataIsolation::create('ORG_DELETE', 'operator'), 1);
    }

    public function testDestroyNonDefaultRoleWithAssignedUsersSucceeds(): void
    {
        $repository = Mockery::mock(ModelAccessRoleRepository::class);
        $adminGlobalSettingsRepository = Mockery::mock(AdminGlobalSettingsRepositoryInterface::class);
        $userDomainService = Mockery::mock(MagicUserDomainService::class);
        $providerModelDomainService = di(ProviderModelDomainService::class);

        $role = $this->makeRole(id: 2, name: '高级角色', isDefault: false, parentRoleId: 1);

        $repository->shouldReceive('getById')
            ->once()
            ->with('ORG_DELETE_CHILD', 2)
            ->andReturn($role);
        $repository->shouldReceive('getRoleUserMap')
            ->once()
            ->with('ORG_DELETE_CHILD', [2])
            ->andReturn([2 => ['u_001', 'u_002']]);
        $repository->shouldReceive('getRoleDeniedModelMap')
            ->once()
            ->with('ORG_DELETE_CHILD', [2])
            ->andReturn([2 => ['gpt-4.1']]);
        $repository->shouldReceive('countChildren')
            ->once()
            ->with('ORG_DELETE_CHILD', 2)
            ->andReturn(0);
        $repository->shouldReceive('replaceUsers')
            ->once()
            ->with('ORG_DELETE_CHILD', 2, [], '');
        $repository->shouldReceive('replaceDeniedModels')
            ->once()
            ->with('ORG_DELETE_CHILD', 2, [], '');
        $repository->shouldReceive('delete')
            ->once()
            ->with('ORG_DELETE_CHILD', 2);
        $adminGlobalSettingsRepository->shouldReceive('getSettingsByTypeAndOrganization')
            ->once()
            ->with(AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL, 'ORG_DELETE_CHILD')
            ->andReturn(null);

        $service = new ModelAccessRoleDomainService($repository, $adminGlobalSettingsRepository, $userDomainService, $providerModelDomainService);

        $result = $service->destroy(PermissionDataIsolation::create('ORG_DELETE_CHILD', 'operator'), 2);

        $this->assertSame(PermissionControlStatus::ENABLED, $result);
    }

    public function testUserSummaryBuildsAccessibleModelsFromDirectAssignedRoleDeniedModels(): void
    {
        $repository = Mockery::mock(ModelAccessRoleRepository::class);
        $adminGlobalSettingsRepository = Mockery::mock(AdminGlobalSettingsRepositoryInterface::class);
        $userDomainService = Mockery::mock(MagicUserDomainService::class);
        $providerModelDomainService = Mockery::mock(ProviderModelDomainService::class);

        $defaultRole = $this->makeRole(id: 1, name: '默认角色', isDefault: true);
        $childRole = $this->makeRole(id: 3, name: '高级角色子', isDefault: false, parentRoleId: 2);

        $repository->shouldReceive('getDefaultRole')
            ->once()
            ->with('ORG_SUMMARY')
            ->andReturn($defaultRole);
        $repository->shouldReceive('getUserAssignedRoles')
            ->once()
            ->with('ORG_SUMMARY', 'u_001')
            ->andReturn([$childRole]);
        $repository->shouldReceive('getRoleUserMap')
            ->once()
            ->with('ORG_SUMMARY', [3])
            ->andReturn([3 => ['u_001']]);
        $repository->shouldReceive('getRoleDeniedModelMap')
            ->once()
            ->with('ORG_SUMMARY', [3])
            ->andReturn([3 => ['claude-opus-4']]);
        $repository->shouldReceive('getDeniedModelIdsByRoleId')
            ->once()
            ->with('ORG_SUMMARY', 3)
            ->andReturn(['claude-opus-4']);
        $adminGlobalSettingsRepository->shouldReceive('getSettingsByTypeAndOrganization')
            ->once()
            ->with(AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL, 'ORG_SUMMARY')
            ->andReturn(null);
        $providerModelDomainService->shouldReceive('getEnableModels')
            ->once()
            ->andReturn([
                new ProviderModelEntity(['model_id' => 'gpt-4.1']),
                new ProviderModelEntity(['model_id' => 'claude-opus-4']),
                new ProviderModelEntity(['model_id' => 'gemini-2.5-pro']),
                new ProviderModelEntity(['model_id' => 'gpt-4o-mini']),
            ]);

        $service = new ModelAccessRoleDomainService($repository, $adminGlobalSettingsRepository, $userDomainService, $providerModelDomainService);

        $summary = $service->getUserSummary(PermissionDataIsolation::create('ORG_SUMMARY', 'operator'), 'u_001');

        $this->assertSame(PermissionControlStatus::ENABLED, $summary['permission_control_status']);
        $this->assertCount(1, $summary['roles']);
        $this->assertSame(['claude-opus-4'], $summary['denied_model_ids']);
        $this->assertSame(['gpt-4.1', 'gemini-2.5-pro', 'gpt-4o-mini'], $summary['accessible_model_ids']);
    }

    public function testUserSummaryKeepsAllModelsWhenUserHasNoAssignedRoles(): void
    {
        $repository = Mockery::mock(ModelAccessRoleRepository::class);
        $adminGlobalSettingsRepository = Mockery::mock(AdminGlobalSettingsRepositoryInterface::class);
        $userDomainService = Mockery::mock(MagicUserDomainService::class);
        $providerModelDomainService = Mockery::mock(ProviderModelDomainService::class);

        $defaultRole = $this->makeRole(id: 1, name: '默认角色', isDefault: true);

        $repository->shouldReceive('getDefaultRole')
            ->once()
            ->with('ORG_SUMMARY_EMPTY')
            ->andReturn($defaultRole);
        $repository->shouldReceive('getUserAssignedRoles')
            ->once()
            ->with('ORG_SUMMARY_EMPTY', 'u_001')
            ->andReturn([]);
        $adminGlobalSettingsRepository->shouldReceive('getSettingsByTypeAndOrganization')
            ->once()
            ->with(AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL, 'ORG_SUMMARY_EMPTY')
            ->andReturn(null);
        $providerModelDomainService->shouldReceive('getEnableModels')
            ->once()
            ->andReturn([
                new ProviderModelEntity(['model_id' => 'gpt-4.1']),
                new ProviderModelEntity(['model_id' => 'claude-opus-4']),
            ]);

        $service = new ModelAccessRoleDomainService($repository, $adminGlobalSettingsRepository, $userDomainService, $providerModelDomainService);

        $summary = $service->getUserSummary(PermissionDataIsolation::create('ORG_SUMMARY_EMPTY', 'operator'), 'u_001');

        $this->assertSame(PermissionControlStatus::ENABLED, $summary['permission_control_status']);
        $this->assertSame([], $summary['roles']);
        $this->assertSame([], $summary['denied_model_ids']);
        $this->assertSame(['gpt-4.1', 'claude-opus-4'], $summary['accessible_model_ids']);
    }

    public function testUpdatePermissionControlStatusPersistsDisabled(): void
    {
        $repository = Mockery::mock(ModelAccessRoleRepository::class);
        $adminGlobalSettingsRepository = Mockery::mock(AdminGlobalSettingsRepositoryInterface::class);
        $userDomainService = Mockery::mock(MagicUserDomainService::class);
        $providerModelDomainService = di(ProviderModelDomainService::class);

        $defaultRole = $this->makeRole(id: 1, name: '默认角色', isDefault: true);

        $repository->shouldReceive('getDefaultRole')
            ->once()
            ->with('ORG_SWITCH')
            ->andReturn($defaultRole);
        $repository->shouldReceive('getDeniedModelIdsByRoleId')
            ->once()
            ->with('ORG_SWITCH', 1)
            ->andReturn(['gpt-4.1']);
        $adminGlobalSettingsRepository->shouldReceive('updateSettings')
            ->once()
            ->with(Mockery::on(static function (AdminGlobalSettingsEntity $entity): bool {
                return $entity->getType() === AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL
                    && $entity->getOrganization() === 'ORG_SWITCH'
                    && $entity->getStatus() === AdminGlobalSettingsStatus::DISABLED;
            }))
            ->andReturnUsing(static fn (AdminGlobalSettingsEntity $entity) => $entity);

        $service = new ModelAccessRoleDomainService($repository, $adminGlobalSettingsRepository, $userDomainService, $providerModelDomainService);

        $result = $service->updatePermissionControlStatus(
            PermissionDataIsolation::create('ORG_SWITCH', 'operator'),
            PermissionControlStatus::DISABLED
        );

        $this->assertSame(PermissionControlStatus::DISABLED, $result['permission_control_status']);
    }

    private function makeRole(
        ?int $id = null,
        string $name = '角色',
        bool $isDefault = false,
        ?int $parentRoleId = null
    ): ModelAccessRoleEntity {
        $role = new ModelAccessRoleEntity();
        $role->setId($id);
        $role->setOrganizationCode('ORG');
        $role->setName($name);
        $role->setIsDefault($isDefault);
        $role->setParentRoleId($parentRoleId);
        return $role;
    }
}
