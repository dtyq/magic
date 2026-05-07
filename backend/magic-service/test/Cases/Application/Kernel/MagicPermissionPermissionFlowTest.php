<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Kernel;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Kernel\MagicPermission;
use Hyperf\Contract\ConfigInterface;
use HyperfTest\HttpTestCase;

/**
 * @internal
 */
class MagicPermissionPermissionFlowTest extends HttpTestCase
{
    private MagicPermission $permission;

    private ConfigInterface $config;

    private bool $originFallbackLegacyTree;

    private array $originResourceMenuMapping;

    private array $originResourceMenuAliasMapping;

    protected function setUp(): void
    {
        parent::setUp();
        $this->permission = new MagicPermission();
        $this->config = $this->getContainer()->get(ConfigInterface::class);
        $this->originFallbackLegacyTree = (bool) $this->config->get('permission_menu.fallback_legacy_tree', false);
        $mapping = $this->config->get('permission_menu.resource_menu_mapping', []);
        $this->originResourceMenuMapping = is_array($mapping) ? $mapping : [];
        $aliasMapping = $this->config->get('permission_menu.resource_menu_alias_mapping', []);
        $this->originResourceMenuAliasMapping = is_array($aliasMapping) ? $aliasMapping : [];
    }

    protected function tearDown(): void
    {
        $this->config->set('permission_menu.fallback_legacy_tree', $this->originFallbackLegacyTree);
        $this->config->set('permission_menu.resource_menu_mapping', $this->originResourceMenuMapping);
        $this->config->set('permission_menu.resource_menu_alias_mapping', $this->originResourceMenuAliasMapping);
        parent::tearDown();
    }

    public function testCheckPermissionDeniesPlatformResourceForNonPlatformOrganizationEvenWithAllPermissionGroup(): void
    {
        $targetPermission = $this->permission->buildPermission(
            MagicResourceEnum::PLATFORM_AI_MODEL->value,
            MagicOperationEnum::QUERY->value
        );

        $result = $this->permission->checkPermission(
            $targetPermission,
            [MagicPermission::ALL_PERMISSIONS],
            false
        );

        $this->assertFalse($result);
    }

    public function testCheckPermissionAllowsPlatformPermissionGroupForPlatformOrganization(): void
    {
        $targetPermission = $this->permission->buildPermission(
            MagicResourceEnum::PLATFORM_AI_MODEL->value,
            MagicOperationEnum::QUERY->value
        );

        $result = $this->permission->checkPermission(
            $targetPermission,
            [MagicPermission::PLATFORM_PERMISSIONS],
            true
        );

        $this->assertTrue($result);
    }

    public function testCheckPermissionPersonPermissionGroupOnlyAllowsWorkspaceResource(): void
    {
        $workspacePermission = $this->permission->buildPermission(
            MagicResourceEnum::WORKSPACE_AI_MODEL->value,
            MagicOperationEnum::EDIT->value
        );
        $adminPermission = $this->permission->buildPermission(
            MagicResourceEnum::SAFE_SUB_ADMIN->value,
            MagicOperationEnum::EDIT->value
        );

        $userPermissions = [MagicPermission::PERSON_PERMISSIONS];
        $this->assertTrue($this->permission->checkPermission($workspacePermission, $userPermissions, false));
        $this->assertFalse($this->permission->checkPermission($adminPermission, $userPermissions, false));
    }

    public function testCheckPermissionPlatformPermissionGroupDoesNotBypassPlatformOrganizationGate(): void
    {
        $targetPermission = $this->permission->buildPermission(
            MagicResourceEnum::PLATFORM_AI_MODEL->value,
            MagicOperationEnum::QUERY->value
        );

        $result = $this->permission->checkPermission(
            $targetPermission,
            [MagicPermission::PLATFORM_PERMISSIONS],
            false
        );

        $this->assertFalse($result);
    }

    public function testCheckPermissionSupportsDirectHitAndEditImplicitlyContainsQuery(): void
    {
        $resource = MagicResourceEnum::WORKSPACE_AI_MODEL->value;
        $queryPermission = $this->permission->buildPermission($resource, MagicOperationEnum::QUERY->value);
        $editPermission = $this->permission->buildPermission($resource, MagicOperationEnum::EDIT->value);

        $this->assertTrue($this->permission->checkPermission($queryPermission, [$queryPermission], false));
        $this->assertTrue($this->permission->checkPermission($queryPermission, [$editPermission], false));
        $this->assertFalse($this->permission->checkPermission($editPermission, [$queryPermission], false));
        $this->assertFalse($this->permission->checkPermission($editPermission, [], false));
    }

    public function testCheckPermissionSupportsModelAccessRoleEditImplicitlyContainsQuery(): void
    {
        $resource = MagicResourceEnum::ADMIN_AI_MODEL_ACCESS_ROLE->value;
        $queryPermission = $this->permission->buildPermission($resource, MagicOperationEnum::QUERY->value);
        $editPermission = $this->permission->buildPermission($resource, MagicOperationEnum::EDIT->value);

        $this->assertTrue($this->permission->checkPermission($queryPermission, [$editPermission], false));
        $this->assertFalse($this->permission->checkPermission($editPermission, [$queryPermission], false));
    }

    public function testGetPermissionTreeUsesMappedPathForMenuKey(): void
    {
        $this->config->set('permission_menu.fallback_legacy_tree', false);
        $this->config->set('permission_menu.resource_menu_mapping', [
            MagicResourceEnum::WORKSPACE_AI_MODEL->value => [
                'path' => [
                    ['key' => 'root_workspace', 'label' => 'Workspace'],
                    ['key' => 'model_manage', 'label' => 'Model'],
                ],
                'tag' => 'Model',
            ],
        ]);

        $tree = $this->permission->getPermissionTree(false);

        $this->assertTrue($this->containsPermissionKey($tree, 'menu.root_workspace'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.root_workspace.model_manage'));
        $this->assertTrue(
            $this->containsPermissionKey(
                $tree,
                $this->permission->buildPermission(MagicResourceEnum::WORKSPACE_AI_MODEL->value, MagicOperationEnum::QUERY->value)
            )
        );
        $this->assertFalse(
            $this->containsPermissionKey(
                $tree,
                $this->permission->buildPermission(MagicResourceEnum::WORKSPACE_AI_IMAGE->value, MagicOperationEnum::QUERY->value)
            )
        );
    }

    public function testGetPermissionTreeCanAppendAliasPathsForSameResource(): void
    {
        $this->config->set('permission_menu.fallback_legacy_tree', false);
        $this->config->set('permission_menu.resource_menu_mapping', [
            MagicResourceEnum::WORKSPACE_AI_MODEL->value => [
                'path' => [
                    ['key' => 'root_workspace', 'label' => 'Workspace'],
                    ['key' => 'model_manage', 'label' => 'Model'],
                ],
                'tag' => 'Model',
            ],
        ]);
        $this->config->set('permission_menu.resource_menu_alias_mapping', [
            MagicResourceEnum::WORKSPACE_AI_MODEL->value => [
                [
                    'path' => [
                        ['key' => 'root_workspace', 'label' => 'Workspace'],
                        ['key' => 'video_model', 'label' => 'Video'],
                    ],
                ],
            ],
        ]);

        $tree = $this->permission->getPermissionTree(false);
        $permissionKey = $this->permission->buildPermission(
            MagicResourceEnum::WORKSPACE_AI_MODEL->value,
            MagicOperationEnum::QUERY->value
        );

        $this->assertTrue($this->containsPermissionKey($tree, 'menu.root_workspace.model_manage'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.root_workspace.video_model'));
        $this->assertSame(2, $this->countPermissionKey($tree, $permissionKey));
    }

    public function testGetPermissionTreePlatformVisibilityDependsOnOrganizationType(): void
    {
        $platformPermission = $this->permission->buildPermission(
            MagicResourceEnum::PLATFORM_AI_MODEL->value,
            MagicOperationEnum::QUERY->value
        );

        $nonPlatformTree = $this->permission->getPermissionTree(false);
        $platformTree = $this->permission->getPermissionTree(true);

        $this->assertFalse($this->containsPermissionKey($nonPlatformTree, $platformPermission));
        $this->assertTrue($this->containsPermissionKey($platformTree, $platformPermission));
    }

    public function testGetPermissionTreeContainsPlatformUserPermissionWhenMapped(): void
    {
        $platformUserPermission = $this->permission->buildPermission(
            MagicResourceEnum::PLATFORM_USER_LIST->value,
            MagicOperationEnum::QUERY->value
        );

        $platformTree = $this->permission->getPermissionTree(true);

        $this->assertTrue($this->containsPermissionKey($platformTree, 'menu.platform_management'));
        $this->assertTrue($this->containsPermissionKey($platformTree, 'menu.platform_management.platform_tenant'));
        $this->assertTrue($this->containsPermissionKey($platformTree, 'menu.platform_management.platform_tenant.platform_user'));
        $this->assertTrue($this->containsPermissionKey($platformTree, $platformUserPermission));
    }

    public function testGetPermissionTreeContainsModelAccessRolePermissionWhenMapped(): void
    {
        $modelAccessRolePermission = $this->permission->buildPermission(
            MagicResourceEnum::ADMIN_AI_MODEL_ACCESS_ROLE->value,
            MagicOperationEnum::QUERY->value
        );

        $tree = $this->permission->getPermissionTree(false);

        $this->assertTrue($this->containsPermissionKey($tree, 'menu.ai_management'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.ai_management.custom_model'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.ai_management.custom_model.model_access_role'));
        $this->assertTrue($this->containsPermissionKey($tree, $modelAccessRolePermission));
    }

    public function testCheckPermissionGroupCompatibilityForOrganizationAdminAnnotationStyle(): void
    {
        $allPermissionQueryKey = $this->permission->buildPermission(
            MagicPermission::ALL_PERMISSIONS,
            MagicOperationEnum::QUERY->value
        );

        // 目标是 ALL 组资源时，PLATFORM 组也应视为命中（ALL ⊂ PLATFORM）
        $this->assertTrue($this->permission->checkPermission(
            $allPermissionQueryKey,
            [MagicPermission::PLATFORM_PERMISSIONS],
            true
        ));
    }

    /**
     * @param array<int, mixed> $nodes
     */
    private function containsPermissionKey(array $nodes, string $permissionKey): bool
    {
        foreach ($nodes as $node) {
            if (! is_array($node)) {
                continue;
            }

            if (($node['permission_key'] ?? '') === $permissionKey) {
                return true;
            }

            $children = $node['children'] ?? [];
            if (is_array($children) && $this->containsPermissionKey($children, $permissionKey)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param array<int, mixed> $nodes
     */
    private function countPermissionKey(array $nodes, string $permissionKey): int
    {
        $count = 0;
        foreach ($nodes as $node) {
            if (! is_array($node)) {
                continue;
            }

            if (($node['permission_key'] ?? '') === $permissionKey) {
                ++$count;
            }

            $children = $node['children'] ?? [];
            if (is_array($children)) {
                $count += $this->countPermissionKey($children, $permissionKey);
            }
        }

        return $count;
    }
}
