<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Permission;

use App\Application\Chat\Service\MagicUserInfoAppService;
use App\Application\Permission\Service\ModelAccessRoleAppService;
use App\Application\Provider\Service\AdminProviderAppService;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Permission\Entity\ModelAccessRoleEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Service\ModelAccessRoleDomainService;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use HyperfTest\HttpTestCase;

/**
 * @internal
 */
class ModelAccessRoleAppServiceTest extends HttpTestCase
{
    public function testDetailReturnsFlatBindingScopeStructure(): void
    {
        $domainService = $this->createMock(ModelAccessRoleDomainService::class);
        $userInfoAppService = $this->createMock(MagicUserInfoAppService::class);
        $departmentDomainService = $this->createMock(MagicDepartmentDomainService::class);
        $providerModelDomainService = $this->createMock(ProviderModelDomainService::class);

        $role = $this->makeRole(
            id: 2,
            name: '研发限制',
            deniedModelIds: ['gpt-4.1'],
            userIds: ['u_001'],
            departmentIds: ['d_001'],
            excludedUserIds: ['u_002'],
            excludedDepartmentIds: ['d_002'],
            allUsers: false,
        );

        $domainService->method('show')->willReturn($role);
        $userInfoAppService->method('getBatchUserInfo')->willReturn([
            'u_001' => ['nickname' => '张三', 'real_name' => '张三', 'avatar_url' => 'https://example.com/a.png'],
            'u_002' => ['nickname' => '李四', 'real_name' => '李四', 'avatar_url' => 'https://example.com/b.png'],
        ]);
        $departmentDomainService->method('getDepartmentByIds')->willReturn([
            'd_001' => new class {
                public function getName(): string
                {
                    return '研发部';
                }
            },
            'd_002' => new class {
                public function getName(): string
                {
                    return '研发管理组';
                }
            },
        ]);
        $departmentDomainService->method('getDepartmentFullPathByIds')->willReturn([
            'd_001' => [
                new class {
                    public function getName(): string
                    {
                        return '总部';
                    }
                },
                new class {
                    public function getName(): string
                    {
                        return '研发部';
                    }
                },
            ],
            'd_002' => [
                new class {
                    public function getName(): string
                    {
                        return '总部';
                    }
                },
                new class {
                    public function getName(): string
                    {
                        return '研发部';
                    }
                },
                new class {
                    public function getName(): string
                    {
                        return '研发管理组';
                    }
                },
            ],
        ]);
        $providerModelDomainService->method('getModelsByModelIds')->willReturn([
            'gpt-4.1' => [new ProviderModelEntity([
                'model_id' => 'gpt-4.1',
                'name' => 'GPT-4.1',
            ])],
        ]);
        $providerModelDomainService->method('getModelByModelId')->willReturn(null);

        $service = new ModelAccessRoleAppService(
            $domainService,
            $userInfoAppService,
            $departmentDomainService,
            $providerModelDomainService,
            $this->createMock(AdminProviderAppService::class),
        );

        $detail = $service->detail(PermissionDataIsolation::create('ORG_APP', 'operator'), 2);

        $this->assertSame('2', $detail['id']);
        $this->assertSame('研发限制', $detail['name']);
        $this->assertArrayNotHasKey('parent_role_id', $detail);
        $this->assertArrayNotHasKey('inherited_path', $detail);
        $this->assertSame(['gpt-4.1'], $detail['denied_model_ids']);
        $this->assertSame('specific', $detail['binding_scope']['type']);
        $this->assertSame(['u_001'], $detail['binding_scope']['user_ids']);
        $this->assertSame(['d_001'], $detail['binding_scope']['department_ids']);
        $this->assertSame('张三', $detail['binding_scope']['user_items'][0]['nickname']);
        $this->assertSame('总部/研发部', $detail['binding_scope']['department_items'][0]['full_path_name']);
        $this->assertSame('specific', $detail['exclusion_scope']['type']);
        $this->assertSame(['u_002'], $detail['exclusion_scope']['user_ids']);
        $this->assertSame(['d_002'], $detail['exclusion_scope']['department_ids']);
        $this->assertSame('李四', $detail['exclusion_scope']['user_items'][0]['nickname']);
        $this->assertSame('总部/研发部/研发管理组', $detail['exclusion_scope']['department_items'][0]['full_path_name']);
    }

    public function testMetaReturnsPermissionControlStatusOnly(): void
    {
        $domainService = $this->createMock(ModelAccessRoleDomainService::class);
        $domainService->method('getMeta')->willReturn([
            'permission_control_status' => PermissionControlStatus::ENABLED,
        ]);

        $service = new ModelAccessRoleAppService(
            $domainService,
            $this->createMock(MagicUserInfoAppService::class),
            $this->createMock(MagicDepartmentDomainService::class),
            $this->createMock(ProviderModelDomainService::class),
            $this->createMock(AdminProviderAppService::class),
        );

        $meta = $service->meta(PermissionDataIsolation::create('ORG_APP', 'operator'));

        $this->assertSame(['permission_control_status' => 'enabled'], $meta);
    }

    public function testQueriesReturnsBindingScopeWithoutDefaultFlags(): void
    {
        $domainService = $this->createMock(ModelAccessRoleDomainService::class);
        $role = $this->makeRole(
            id: 3,
            name: '组织基线',
            deniedModelIds: ['gpt-4.1'],
            excludedUserIds: ['u_003'],
            excludedDepartmentIds: ['d_003'],
            allUsers: true,
        );

        $domainService->method('queries')->willReturn([
            'total' => 1,
            'list' => [$role],
        ]);
        $domainService->method('countAssignedUsers')->willReturn(120);

        $service = new ModelAccessRoleAppService(
            $domainService,
            $this->createMock(MagicUserInfoAppService::class),
            $this->createMock(MagicDepartmentDomainService::class),
            $this->createMock(ProviderModelDomainService::class),
            $this->createMock(AdminProviderAppService::class),
        );

        $result = $service->queries(PermissionDataIsolation::create('ORG_APP', 'operator'), new Page(1, 20));

        $this->assertSame('organization_all', $result['list'][0]['binding_scope']['type']);
        $this->assertSame(1, $result['list'][0]['exclusion_user_count']);
        $this->assertSame(1, $result['list'][0]['exclusion_department_count']);
        $this->assertArrayNotHasKey('is_default', $result['list'][0]);
        $this->assertArrayNotHasKey('parent_role_id', $result['list'][0]);
    }

    private function makeRole(
        int $id,
        string $name,
        array $deniedModelIds = [],
        array $userIds = [],
        array $departmentIds = [],
        array $excludedUserIds = [],
        array $excludedDepartmentIds = [],
        bool $allUsers = false
    ): ModelAccessRoleEntity {
        $role = new ModelAccessRoleEntity();
        $role->setId($id);
        $role->setOrganizationCode('ORG_APP');
        $role->setName($name);
        $role->setDeniedModelIds($deniedModelIds);
        $role->setUserIds($userIds);
        $role->setDepartmentIds($departmentIds);
        $role->setExcludedUserIds($excludedUserIds);
        $role->setExcludedDepartmentIds($excludedDepartmentIds);
        $role->setAllUsers($allUsers);
        return $role;
    }
}
