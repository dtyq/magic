<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Permission;

use App\Application\Kernel\Contract\MagicPermissionInterface;
use App\Application\Kernel\MagicPermission;
use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\Domain\OrganizationEnvironment\Entity\OrganizationEntity;
use App\Domain\OrganizationEnvironment\Repository\Facade\OrganizationRepositoryInterface;
use App\Domain\Permission\Entity\RoleEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Repository\Facade\RoleRepositoryInterface;
use App\Domain\Permission\Service\RoleDomainService;
use App\Infrastructure\Core\Exception\BusinessException;
use Hyperf\Contract\ConfigInterface;
use HyperfTest\HttpTestCase;
use Mockery;
use stdClass;

/**
 * @internal
 */
class RoleDomainServicePermissionTest extends HttpTestCase
{
    private ConfigInterface $config;

    private string $originOfficeOrganization;

    private array $originResourceMenuMapping;

    private bool $originFallbackLegacyTree;

    protected function setUp(): void
    {
        parent::setUp();
        $this->config = $this->getContainer()->get(ConfigInterface::class);
        $this->originOfficeOrganization = (string) $this->config->get('service_provider.office_organization', '');
        $mapping = $this->config->get('permission_menu.resource_menu_mapping', []);
        $this->originResourceMenuMapping = is_array($mapping) ? $mapping : [];
        $this->originFallbackLegacyTree = (bool) $this->config->get('permission_menu.fallback_legacy_tree', false);
    }

    protected function tearDown(): void
    {
        $this->config->set('service_provider.office_organization', $this->originOfficeOrganization);
        $this->config->set('permission_menu.resource_menu_mapping', $this->originResourceMenuMapping);
        $this->config->set('permission_menu.fallback_legacy_tree', $this->originFallbackLegacyTree);
        parent::tearDown();
    }

    public function testSaveThrowsWhenPermissionKeyIsInvalid(): void
    {
        $roleRepository = Mockery::mock(RoleRepositoryInterface::class);
        $permission = Mockery::mock(MagicPermissionInterface::class);
        $userRepository = Mockery::mock(MagicUserRepositoryInterface::class);
        $organizationRepository = Mockery::mock(OrganizationRepositoryInterface::class);

        $service = new RoleDomainService(
            $roleRepository,
            $permission,
            $userRepository,
            $organizationRepository
        );

        $permission->shouldReceive('isValidPermission')
            ->once()
            ->with('invalid.permission.key')
            ->andReturn(false);
        $roleRepository->shouldNotReceive('save');

        $role = new RoleEntity();
        $role->setName('TEST_ROLE');
        $role->setStatus(1);
        $role->setPermissions(['invalid.permission.key']);

        $this->expectException(BusinessException::class);

        $service->save(PermissionDataIsolation::create('ORG_INVALID', 'operator_1'), $role);
    }

    public function testSaveExtractsUniquePermissionTagAndSkipsPermissionGroupConstants(): void
    {
        $this->config->set('permission_menu.fallback_legacy_tree', false);
        $this->config->set('permission_menu.resource_menu_mapping', [
            'workspace.ai.model_management' => [
                'path' => [
                    ['key' => 'workspace', 'label' => 'Workspace'],
                    ['key' => 'models', 'label' => 'Models'],
                ],
                'tag' => 'MODEL_TAG',
            ],
            'workspace.ai.image_generation' => [
                'path' => [
                    ['key' => 'workspace', 'label' => 'Workspace'],
                    ['key' => 'models', 'label' => 'Models'],
                ],
                'tag' => 'MODEL_TAG',
            ],
        ]);

        $roleRepository = Mockery::mock(RoleRepositoryInterface::class);
        $userRepository = Mockery::mock(MagicUserRepositoryInterface::class);
        $organizationRepository = Mockery::mock(OrganizationRepositoryInterface::class);
        $permission = new MagicPermission();

        $service = new RoleDomainService(
            $roleRepository,
            $permission,
            $userRepository,
            $organizationRepository
        );

        $roleRepository->shouldReceive('getByName')
            ->once()
            ->with('ORG_TAG', 'TAG_ROLE')
            ->andReturn(null);
        $roleRepository->shouldReceive('save')
            ->once()
            ->with(
                'ORG_TAG',
                Mockery::on(static function (RoleEntity $role): bool {
                    return $role->getPermissionTag() === ['MODEL_TAG'];
                })
            )
            ->andReturnUsing(static function (string $organizationCode, RoleEntity $entity): RoleEntity {
                $entity->setId(10001);
                return $entity;
            });
        $roleRepository->shouldNotReceive('assignUsers');

        $role = new RoleEntity();
        $role->setName('TAG_ROLE');
        $role->setStatus(1);
        $role->setPermissions([
            'workspace.ai.model_management.query',
            'workspace.ai.image_generation.edit',
            MagicPermission::ALL_PERMISSIONS,
            MagicPermission::PLATFORM_PERMISSIONS,
        ]);

        $saved = $service->save(PermissionDataIsolation::create('ORG_TAG', 'operator_tag'), $role);

        $this->assertSame(['MODEL_TAG'], $saved->getPermissionTag());
    }

    public function testHasPermissionPassesPlatformOrganizationFlagToMagicPermission(): void
    {
        $this->config->set('service_provider.office_organization', 'OFFICIAL_ORG');

        $roleRepository = Mockery::mock(RoleRepositoryInterface::class);
        $permission = Mockery::mock(MagicPermissionInterface::class);
        $userRepository = Mockery::mock(MagicUserRepositoryInterface::class);
        $organizationRepository = Mockery::mock(OrganizationRepositoryInterface::class);

        $service = new RoleDomainService(
            $roleRepository,
            $permission,
            $userRepository,
            $organizationRepository
        );

        $roleRepository->shouldReceive('getUserPermissions')
            ->once()
            ->with('OFFICIAL_ORG', 'user_1')
            ->andReturn(['permission.a']);
        $permission->shouldReceive('checkPermission')
            ->once()
            ->with('target.permission', ['permission.a'], true)
            ->andReturn(true);

        $allowed = $service->hasPermission(
            PermissionDataIsolation::create('OFFICIAL_ORG', 'operator'),
            'user_1',
            'target.permission'
        );

        $this->assertTrue($allowed);
    }

    public function testHasPermissionPassesFalseFlagForNonPlatformOrganization(): void
    {
        $this->config->set('service_provider.office_organization', 'OFFICIAL_ORG');

        $roleRepository = Mockery::mock(RoleRepositoryInterface::class);
        $permission = Mockery::mock(MagicPermissionInterface::class);
        $userRepository = Mockery::mock(MagicUserRepositoryInterface::class);
        $organizationRepository = Mockery::mock(OrganizationRepositoryInterface::class);

        $service = new RoleDomainService(
            $roleRepository,
            $permission,
            $userRepository,
            $organizationRepository
        );

        $roleRepository->shouldReceive('getUserPermissions')
            ->once()
            ->with('NORMAL_ORG', 'user_2')
            ->andReturn(['permission.b']);
        $permission->shouldReceive('checkPermission')
            ->once()
            ->with('target.permission', ['permission.b'], false)
            ->andReturn(false);

        $allowed = $service->hasPermission(
            PermissionDataIsolation::create('NORMAL_ORG', 'operator'),
            'user_2',
            'target.permission'
        );

        $this->assertFalse($allowed);
    }

    public function testAddOrganizationAdminUsesPersonPermissionForPersonalOrganization(): void
    {
        $this->assertOrganizationAdminPermissionByOrgType(
            'ORG_ADMIN_PERSON',
            1,
            MagicPermission::PERSON_PERMISSIONS
        );
    }

    public function testAddOrganizationAdminUsesAllPermissionForTeamOrganization(): void
    {
        $this->assertOrganizationAdminPermissionByOrgType(
            'ORG_ADMIN_TEAM',
            0,
            MagicPermission::ALL_PERMISSIONS
        );
    }

    public function testAddOrganizationAdminUsesPlatformPermissionForPlatformOrganization(): void
    {
        $this->config->set('service_provider.office_organization', 'ORG_ADMIN_PLATFORM');

        $this->assertOrganizationAdminPermissionByOrgType(
            'ORG_ADMIN_PLATFORM',
            0,
            MagicPermission::PLATFORM_PERMISSIONS
        );
    }

    private function assertOrganizationAdminPermissionByOrgType(string $organizationCode, int $organizationType, string $expectedPermission): void
    {
        $roleRepository = Mockery::mock(RoleRepositoryInterface::class);
        $userRepository = Mockery::mock(MagicUserRepositoryInterface::class);
        $organizationRepository = Mockery::mock(OrganizationRepositoryInterface::class);
        $permission = new MagicPermission();

        $service = new RoleDomainService(
            $roleRepository,
            $permission,
            $userRepository,
            $organizationRepository
        );

        $organization = new OrganizationEntity();
        $organization->setType($organizationType);

        if ($expectedPermission === MagicPermission::PLATFORM_PERMISSIONS) {
            $organizationRepository->shouldNotReceive('getByCode');
        } else {
            $organizationRepository->shouldReceive('getByCode')
                ->once()
                ->with($organizationCode)
                ->andReturn($organization);
        }
        $roleRepository->shouldReceive('getByName')
            ->twice()
            ->with($organizationCode, RoleDomainService::ORGANIZATION_ADMIN_ROLE_NAME)
            ->andReturn(null);
        $userRepository->shouldReceive('getByUserIds')
            ->once()
            ->with($organizationCode, ['user_admin_1'])
            ->andReturn(['user_admin_1' => new stdClass()]);
        $roleRepository->shouldReceive('save')
            ->once()
            ->with(
                $organizationCode,
                Mockery::on(static function (RoleEntity $entity) use ($expectedPermission): bool {
                    return $entity->getPermissions() === [$expectedPermission]
                        && $entity->getIsDisplay() === 0
                        && $entity->getStatus() === 1;
                })
            )
            ->andReturnUsing(static function (string $organizationCode, RoleEntity $entity): RoleEntity {
                $entity->setId(9001);
                return $entity;
            });
        $roleRepository->shouldReceive('assignUsers')
            ->once()
            ->with($organizationCode, 9001, ['user_admin_1'], 'operator_admin');

        $saved = $service->addOrganizationAdmin(
            PermissionDataIsolation::create($organizationCode, 'operator_admin'),
            ['user_admin_1']
        );

        $this->assertSame([$expectedPermission], $saved->getPermissions());
    }
}
