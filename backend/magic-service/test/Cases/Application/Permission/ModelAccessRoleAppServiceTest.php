<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Permission;

use App\Application\Chat\Service\MagicUserInfoAppService;
use App\Application\Permission\Service\ModelAccessRoleAppService;
use App\Application\Provider\Service\AdminProviderAppService;
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
use App\Infrastructure\Core\ValueObject\Page;
use HyperfTest\HttpTestCase;
use Mockery;

/**
 * @internal
 */
class ModelAccessRoleAppServiceTest extends HttpTestCase
{
    public function testDetailReturnsEditableStructure(): void
    {
        $repository = Mockery::mock(ModelAccessRoleRepository::class);
        $adminGlobalSettingsRepository = Mockery::mock(AdminGlobalSettingsRepositoryInterface::class);
        $userInfoAppService = Mockery::mock(MagicUserInfoAppService::class);
        $providerModelDomainService = Mockery::mock(ProviderModelDomainService::class);
        $adminProviderAppService = Mockery::mock(AdminProviderAppService::class);

        $parentRole = $this->makeRole(id: 1, name: '默认角色', isDefault: true);
        $role = $this->makeRole(id: 2, name: '高级角色-A', isDefault: false, parentRoleId: 1);
        $role->setModelIds(['gpt-4.1']);
        $role->setUserIds(['u_001', 'u_002']);

        $repository->shouldReceive('getById')
            ->once()
            ->with('ORG_APP', 2)
            ->andReturn($role);
        $repository->shouldReceive('getRoleUserMap')
            ->once()
            ->with('ORG_APP', [2])
            ->andReturn([2 => ['u_001', 'u_002']]);
        $repository->shouldReceive('getRoleModelMap')
            ->once()
            ->with('ORG_APP', [2])
            ->andReturn([2 => []]);
        $repository->shouldReceive('getById')
            ->twice()
            ->with('ORG_APP', 1)
            ->andReturn($parentRole);
        $repository->shouldReceive('getRoleUserMap')
            ->twice()
            ->with('ORG_APP', [1])
            ->andReturn([]);
        $repository->shouldReceive('getRoleModelMap')
            ->twice()
            ->with('ORG_APP', [1])
            ->andReturn([]);

        $userInfoAppService->shouldReceive('getBatchUserInfo')
            ->once()
            ->andReturn([
                'u_001' => ['nickname' => '张三', 'real_name' => '张三', 'avatar_url' => 'https://example.com/a.png'],
                'u_002' => ['nickname' => '李四', 'real_name' => '李四', 'avatar_url' => 'https://example.com/b.png'],
            ]);
        $providerModelDomainService->shouldReceive('getModelsByModelIds')->once()->andReturn([
            'gpt-4.1' => [new ProviderModelEntity([
                'model_id' => 'gpt-4.1',
                'name' => 'GPT-4.1',
            ])],
        ]);

        $domainService = new ModelAccessRoleDomainService($repository, $adminGlobalSettingsRepository, Mockery::mock(MagicUserDomainService::class), $providerModelDomainService);
        $service = new ModelAccessRoleAppService($domainService, $userInfoAppService, $providerModelDomainService, $adminProviderAppService);

        $detail = $service->detail(PermissionDataIsolation::create('ORG_APP', 'operator'), 2);

        $this->assertSame('2', $detail['id']);
        $this->assertSame('高级角色-A', $detail['name']);
        $this->assertSame('1', $detail['parent_role_id']);
        $this->assertSame(['gpt-4.1'], $detail['model_ids']);
        $this->assertSame(['u_001', 'u_002'], $detail['user_ids']);
        $this->assertSame([[
            'model_id' => 'gpt-4.1',
            'model_name' => 'GPT-4.1',
        ]], $detail['model_items']);
        $this->assertCount(2, $detail['user_items']);
        $this->assertSame('张三', $detail['user_items'][0]['nickname']);
        $this->assertCount(2, $detail['inherited_path']);
    }

    public function testMetaReturnsPermissionControlStatus(): void
    {
        $repository = Mockery::mock(ModelAccessRoleRepository::class);
        $adminGlobalSettingsRepository = Mockery::mock(AdminGlobalSettingsRepositoryInterface::class);
        $userInfoAppService = Mockery::mock(MagicUserInfoAppService::class);
        $providerModelDomainService = Mockery::mock(ProviderModelDomainService::class);
        $adminProviderAppService = Mockery::mock(AdminProviderAppService::class);

        $defaultRole = $this->makeRole(id: 1, name: '默认角色', isDefault: true);

        $repository->shouldReceive('getDefaultRole')
            ->once()
            ->with('ORG_APP')
            ->andReturn($defaultRole);
        $repository->shouldReceive('getModelIdsByRoleId')
            ->once()
            ->with('ORG_APP', 1)
            ->andReturn(['gpt-4.1', 'claude-sonnet-4']);
        $adminGlobalSettingsRepository->shouldReceive('getSettingsByTypeAndOrganization')
            ->once()
            ->with(AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL, 'ORG_APP')
            ->andReturn(null);

        $domainService = new ModelAccessRoleDomainService($repository, $adminGlobalSettingsRepository, Mockery::mock(MagicUserDomainService::class), $providerModelDomainService);
        $service = new ModelAccessRoleAppService($domainService, $userInfoAppService, $providerModelDomainService, $adminProviderAppService);

        $meta = $service->meta(PermissionDataIsolation::create('ORG_APP', 'operator'));

        $this->assertSame(PermissionControlStatus::ENABLED->value, $meta['permission_control_status']);
        $this->assertSame(2, $meta['default_role']['model_count']);
    }

    public function testQueriesReturnsModelIds(): void
    {
        $repository = Mockery::mock(ModelAccessRoleRepository::class);
        $adminGlobalSettingsRepository = Mockery::mock(AdminGlobalSettingsRepositoryInterface::class);
        $userInfoAppService = Mockery::mock(MagicUserInfoAppService::class);
        $providerModelDomainService = Mockery::mock(ProviderModelDomainService::class);
        $adminProviderAppService = Mockery::mock(AdminProviderAppService::class);

        $role = $this->makeRole(id: 2, name: '高级角色-A', isDefault: false, parentRoleId: 1);
        $role->setModelIds(['gpt-4.1', 'claude-opus-4']);
        $role->setUserIds(['u_001']);

        $parentRole = $this->makeRole(id: 1, name: '默认角色', isDefault: true);

        $repository->shouldReceive('queries')->once()->andReturn(['total' => 1, 'list' => [$role]]);
        $repository->shouldReceive('getRoleUserMap')->once()->with('ORG_APP', [2])->andReturn([2 => ['u_001']]);
        $repository->shouldReceive('getRoleModelMap')->once()->with('ORG_APP', [2])->andReturn([2 => ['gpt-4.1', 'claude-opus-4']]);
        $repository->shouldReceive('getById')->once()->with('ORG_APP', 1)->andReturn($parentRole);
        $repository->shouldReceive('getRoleUserMap')->once()->with('ORG_APP', [1])->andReturn([]);
        $repository->shouldReceive('getRoleModelMap')->once()->with('ORG_APP', [1])->andReturn([]);

        $domainService = new ModelAccessRoleDomainService($repository, $adminGlobalSettingsRepository, Mockery::mock(MagicUserDomainService::class), $providerModelDomainService);
        $service = new ModelAccessRoleAppService($domainService, $userInfoAppService, $providerModelDomainService, $adminProviderAppService);

        $result = $service->queries(PermissionDataIsolation::create('ORG_APP', 'operator'), new Page(1, 20));

        $this->assertSame(['gpt-4.1', 'claude-opus-4'], $result['list'][0]['model_ids']);
    }

    private function makeRole(
        ?int $id = null,
        string $name = '角色',
        bool $isDefault = false,
        ?int $parentRoleId = null
    ): ModelAccessRoleEntity {
        $role = new ModelAccessRoleEntity();
        $role->setId($id);
        $role->setOrganizationCode('ORG_APP');
        $role->setName($name);
        $role->setIsDefault($isDefault);
        $role->setParentRoleId($parentRoleId);
        return $role;
    }
}
