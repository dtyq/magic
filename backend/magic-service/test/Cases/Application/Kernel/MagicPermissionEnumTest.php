<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Kernel;

use App\Application\Kernel\Contract\MagicPermissionInterface;
use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Kernel\MagicPermission;
use HyperfTest\HttpTestCase;
use InvalidArgumentException;

/**
 * @internal
 */
class MagicPermissionEnumTest extends HttpTestCase
{
    private MagicPermissionInterface $permission;

    protected function setUp(): void
    {
        parent::setUp();
        $this->permission = di(MagicPermissionInterface::class);
    }

    public function testGetOperations(): void
    {
        $operations = $this->permission->getOperations();

        $this->assertSame([MagicOperationEnum::QUERY->value, MagicOperationEnum::EDIT->value], $operations);
    }

    public function testParsePermissionWithValidKey(): void
    {
        $permissionKey = 'workspace.ai.model_management.query';
        $parsed = $this->permission->parsePermission($permissionKey);

        $this->assertSame('workspace.ai.model_management', $parsed['resource']);
        $this->assertSame('query', $parsed['operation']);
    }

    public function testParsePermissionWithInvalidKey(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid permission key format');

        $this->permission->parsePermission('invalid_key_without_dot');
    }

    public function testGenerateAllPermissionsContainsWorkspaceAiResources(): void
    {
        $permissions = $this->permission->generateAllPermissions();
        $permissionKeys = array_column($permissions, 'permission_key');

        $this->assertContains('workspace.ai.model_management.query', $permissionKeys);
        $this->assertContains('workspace.ai.model_management.edit', $permissionKeys);
        $this->assertContains('workspace.ai.image_generation.query', $permissionKeys);
        $this->assertContains('workspace.ai.image_generation.edit', $permissionKeys);
    }

    public function testIsValidPermission(): void
    {
        $this->assertTrue($this->permission->isValidPermission(MagicPermission::ALL_PERMISSIONS));
        $this->assertTrue($this->permission->isValidPermission(MagicPermission::PERSON_PERMISSIONS));
        $this->assertTrue($this->permission->isValidPermission(MagicPermission::PLATFORM_PERMISSIONS));
        $this->assertTrue($this->permission->isValidPermission('workspace.ai.model_management.query'));
        $this->assertTrue($this->permission->isValidPermission('workspace.ai.image_generation.edit'));
        $this->assertFalse($this->permission->isValidPermission('admin.ai.model_management.query'));
        $this->assertFalse($this->permission->isValidPermission('workspace.ai.model_management.manage'));
    }

    public function testBuildPermission(): void
    {
        $permissionKey = $this->permission->buildPermission(
            MagicResourceEnum::WORKSPACE_AI_MODEL->value,
            MagicOperationEnum::EDIT->value
        );

        $this->assertSame('workspace.ai.model_management.edit', $permissionKey);
    }

    public function testGetPermissionTreeForNonPlatformOrganization(): void
    {
        $tree = $this->permission->getPermissionTree(false);

        $this->assertTrue($this->containsPermissionKey($tree, 'workspace.ai.model_management.query'));
        $this->assertTrue($this->containsPermissionKey($tree, 'workspace.ai.image_generation.edit'));
        $this->assertFalse($this->containsPermissionKey($tree, 'platform.ai.model_management.query'));
    }

    public function testPersonPermissionsOnlyAllowWorkspaceResources(): void
    {
        $this->assertTrue($this->permission->checkPermission(
            'workspace.ai.model_management.query',
            [MagicPermission::PERSON_PERMISSIONS],
            false
        ));

        $this->assertFalse($this->permission->checkPermission(
            'admin.safe.sub_admin.query',
            [MagicPermission::PERSON_PERMISSIONS],
            false
        ));

        $this->assertFalse($this->permission->checkPermission(
            'platform.ai.model_management.query',
            [MagicPermission::PERSON_PERMISSIONS],
            true
        ));
    }

    public function testPermissionGroupsHierarchyForPlatformPermissions(): void
    {
        // ALL 权限组不包含 platform.*
        $this->assertFalse($this->permission->checkPermission(
            'platform.ai.model_management.query',
            [MagicPermission::ALL_PERMISSIONS],
            true
        ));

        // PLATFORM 权限组包含 admin/workspace/platform
        $this->assertTrue($this->permission->checkPermission(
            'platform.ai.model_management.query',
            [MagicPermission::PLATFORM_PERMISSIONS],
            true
        ));
        $this->assertTrue($this->permission->checkPermission(
            'admin.safe.sub_admin.edit',
            [MagicPermission::PLATFORM_PERMISSIONS],
            true
        ));
        $this->assertTrue($this->permission->checkPermission(
            'workspace.ai.model_management.query',
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
}
