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
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Permission\Entity\ModelAccessRoleEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionControlStatus;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Repository\Persistence\ModelAccessRoleRepository;
use App\Domain\Permission\Service\ModelAccessRoleDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use HyperfTest\HttpTestCase;

/**
 * @internal
 */
class ModelAccessRoleDomainServiceTest extends HttpTestCase
{
    public function testGetMetaReturnsDisabledWhenSettingMissing(): void
    {
        $repository = $this->createMock(ModelAccessRoleRepository::class);
        $settingsRepository = $this->createMock(AdminGlobalSettingsRepositoryInterface::class);
        $settingsRepository
            ->method('getSettingsByTypeAndOrganization')
            ->with(AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL, 'ORG_META')
            ->willReturn(null);

        $service = $this->createService(
            repository: $repository,
            settingsRepository: $settingsRepository,
        );

        $result = $service->getMeta(PermissionDataIsolation::create('ORG_META', 'operator'));

        $this->assertSame(PermissionControlStatus::DISABLED, $result['permission_control_status']);
        $this->assertArrayNotHasKey('default_role', $result);
    }

    public function testCreateRoleAllowsOrganizationAllWithoutDefaultRole(): void
    {
        $repository = $this->createMock(ModelAccessRoleRepository::class);
        $repository->expects($this->once())
            ->method('getByName')
            ->with('ORG_CREATE', '组织基线')
            ->willReturn(null);
        $repository->expects($this->once())
            ->method('save')
            ->willReturnCallback(static function (ModelAccessRoleEntity $entity): ModelAccessRoleEntity {
                $entity->setId(9);
                return $entity;
            });
        $repository->expects($this->once())
            ->method('replaceDeniedModels')
            ->with('ORG_CREATE', 9, [], 'operator');
        $repository->expects($this->once())
            ->method('replaceBindings')
            ->with('ORG_CREATE', 9, [], [], true, 'operator');
        $repository->expects($this->once())
            ->method('getById')
            ->with('ORG_CREATE', 9)
            ->willReturn($this->makeRole(id: 9, name: '组织基线', allUsers: true));
        $repository->expects($this->once())
            ->method('getRoleBindingMap')
            ->with('ORG_CREATE', [9])
            ->willReturn([
                9 => [
                    'user_ids' => [],
                    'department_ids' => [],
                    'all_users' => true,
                ],
            ]);
        $repository->expects($this->once())
            ->method('getRoleDeniedModelMap')
            ->with('ORG_CREATE', [9])
            ->willReturn([]);

        $service = $this->createService(repository: $repository);

        $entity = $this->makeRole(name: '组织基线', allUsers: true);
        $result = $service->createRole(PermissionDataIsolation::create('ORG_CREATE', 'operator'), $entity);

        $this->assertSame(9, $result->getId());
        $this->assertTrue($result->isAllUsers());
    }

    public function testGetUserSummaryUsesDenyUnionAcrossMatchedRoles(): void
    {
        $repository = $this->createMock(ModelAccessRoleRepository::class);
        $settingsRepository = $this->createMock(AdminGlobalSettingsRepositoryInterface::class);
        $departmentUserDomainService = $this->createMock(MagicDepartmentUserDomainService::class);
        $providerModelDomainService = $this->createMock(ProviderModelDomainService::class);

        $roleA = $this->makeRole(id: 1, name: '组织基线');
        $roleB = $this->makeRole(id: 2, name: '研发限制');

        $settingsRepository
            ->method('getSettingsByTypeAndOrganization')
            ->with(AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL, 'ORG_SUMMARY')
            ->willReturn(
                (new AdminGlobalSettingsEntity())
                    ->setType(AdminGlobalSettingsType::MODEL_ACCESS_PERMISSION_CONTROL)
                    ->setOrganization('ORG_SUMMARY')
                    ->setStatus(AdminGlobalSettingsStatus::ENABLED)
            );
        $departmentUserDomainService
            ->method('getDepartmentIdsByUserId')
            ->willReturn(['dep-1']);
        $repository->method('getUserAssignedRoles')
            ->with('ORG_SUMMARY', 'user-1', ['dep-1'])
            ->willReturn([$roleA, $roleB]);
        $repository->method('getRoleBindingMap')
            ->with('ORG_SUMMARY', [1, 2])
            ->willReturn([]);
        $repository->method('getRoleDeniedModelMap')
            ->with('ORG_SUMMARY', [1, 2])
            ->willReturn([
                1 => ['model-a'],
                2 => ['model-b'],
            ]);
        $repository->method('getDeniedModelIdsByRoleId')
            ->willReturnCallback(static fn (string $organizationCode, int $roleId): array => match ($roleId) {
                1 => ['model-a'],
                2 => ['model-b'],
                default => [],
            });
        $providerModelDomainService->method('getEnableModels')->willReturn([
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
            new class('model-c') {
                public function __construct(private readonly string $modelId)
                {
                }

                public function getModelId(): string
                {
                    return $this->modelId;
                }
            },
        ]);

        $service = $this->createService(
            repository: $repository,
            settingsRepository: $settingsRepository,
            departmentUserDomainService: $departmentUserDomainService,
            providerModelDomainService: $providerModelDomainService,
        );

        $summary = $service->getUserSummary(
            PermissionDataIsolation::create('ORG_SUMMARY', 'operator'),
            'user-1'
        );

        $this->assertSame(PermissionControlStatus::ENABLED, $summary['permission_control_status']);
        $this->assertCount(2, $summary['roles']);
        $this->assertSame(['model-a', 'model-b'], $summary['denied_model_ids']);
        $this->assertSame(['model-c'], $summary['accessible_model_ids']);
    }

    private function createService(
        ?ModelAccessRoleRepository $repository = null,
        ?AdminGlobalSettingsRepositoryInterface $settingsRepository = null,
        ?MagicDepartmentDomainService $departmentDomainService = null,
        ?MagicDepartmentUserDomainService $departmentUserDomainService = null,
        ?MagicUserDomainService $userDomainService = null,
        ?ProviderModelDomainService $providerModelDomainService = null,
    ): ModelAccessRoleDomainService {
        return new ModelAccessRoleDomainService(
            $repository ?? $this->createMock(ModelAccessRoleRepository::class),
            $settingsRepository ?? $this->createMock(AdminGlobalSettingsRepositoryInterface::class),
            $departmentDomainService ?? $this->createMock(MagicDepartmentDomainService::class),
            $departmentUserDomainService ?? $this->createMock(MagicDepartmentUserDomainService::class),
            $userDomainService ?? $this->createMock(MagicUserDomainService::class),
            $providerModelDomainService ?? $this->createMock(ProviderModelDomainService::class),
        );
    }

    private function makeRole(
        ?int $id = null,
        string $name = '角色',
        bool $allUsers = false
    ): ModelAccessRoleEntity {
        $role = new ModelAccessRoleEntity();
        $role->setId($id);
        $role->setOrganizationCode('ORG_TEST');
        $role->setName($name);
        $role->setAllUsers($allUsers);
        return $role;
    }
}
