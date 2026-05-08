<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Kernel;

use App\Application\Kernel\Contract\MagicPermissionInterface;
use Dtyq\MagicEnterprise\Application\Kernel\Enum\EnterpriseOperationAiContentAuditEnum;
use Dtyq\MagicEnterprise\Application\Kernel\Enum\EnterpriseOperationPlatformOrganizationPointManagerEnum;
use Dtyq\MagicEnterprise\Application\Kernel\Enum\EnterpriseResourceEnum;
use Hyperf\Contract\ConfigInterface;
use HyperfTest\HttpTestCase;

/**
 * @internal
 */
class EnterprisePermissionTreeTest extends HttpTestCase
{
    private MagicPermissionInterface $permission;

    private ConfigInterface $config;

    protected function setUp(): void
    {
        parent::setUp();
        $this->permission = di(MagicPermissionInterface::class);
        $this->config = di(ConfigInterface::class);

        $mapping = $this->config->get('permission_menu.resource_menu_mapping', []);
        if (! is_array($mapping) || ! isset($mapping[EnterpriseResourceEnum::PLATFORM_PRODUCT_MANAGE->value])) {
            self::markTestSkipped('Current magic-service runtime is still using an old magic-enterprise-service package; refresh Composer dependencies before enabling this test.');
        }
    }

    public function testGetPermissionTreeContainsEnterpriseMappingsForPlatformOrganization(): void
    {
        $tree = $this->permission->getPermissionTree(true);

        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.platform_package.subscription_package'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.platform_package.order_management'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.platform_tenant.tenant_points'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.platform_console_management.content_audit'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.platform_console_management.proxy_server'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.platform_model.video_model'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.agent_enhancement.skill_review'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.agent_enhancement.skill_market'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.agent_enhancement.employee_review'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.agent_enhancement.employee_market'));

        $this->assertTrue($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(EnterpriseResourceEnum::PLATFORM_PRODUCT_MANAGE->value, 'query')
        ));
        $this->assertTrue($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(EnterpriseResourceEnum::PLATFORM_PRODUCT_ORDER->value, 'query')
        ));
        $this->assertTrue($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(
                EnterpriseResourceEnum::PLATFORM_ORGANIZATION_POINT_MANAGER->value,
                EnterpriseOperationPlatformOrganizationPointManagerEnum::BIND_PACKAGE->value
            )
        ));
        $this->assertTrue($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(
                EnterpriseResourceEnum::PLATFORM_AI_CONTENT_AUDIT->value,
                EnterpriseOperationAiContentAuditEnum::RISK->value
            )
        ));
        $this->assertTrue($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(EnterpriseResourceEnum::PLATFORM_PROXY_SERVER->value, 'edit')
        ));
    }

    public function testGetPermissionTreeUsesAliasMenusWithoutCreatingFakeOrderEditPermission(): void
    {
        $tree = $this->permission->getPermissionTree(true);

        $platformModelQuery = $this->permission->buildPermission('platform.ai.model_management', 'query');
        $skillManagementQuery = $this->permission->buildPermission('platform.ai.skill_management', 'query');
        $agentManagementQuery = $this->permission->buildPermission('platform.ai.agent_management', 'query');
        $orderQuery = $this->permission->buildPermission(EnterpriseResourceEnum::PLATFORM_PRODUCT_ORDER->value, 'query');

        $this->assertSame(2, $this->countPermissionKey($tree, $platformModelQuery));
        $this->assertSame(3, $this->countPermissionKey($tree, $skillManagementQuery));
        $this->assertSame(3, $this->countPermissionKey($tree, $agentManagementQuery));
        $this->assertTrue($this->containsPermissionKey($tree, $orderQuery));
        $this->assertFalse($this->containsPermissionKey(
            $tree,
            EnterpriseResourceEnum::PLATFORM_PRODUCT_ORDER->value . '.edit'
        ));
    }

    public function testGetPermissionTreeUsesTranslatedBindPackageOperationLabel(): void
    {
        $tree = $this->permission->getPermissionTree(true);
        $bindPackagePermission = $this->permission->buildPermission(
            EnterpriseResourceEnum::PLATFORM_ORGANIZATION_POINT_MANAGER->value,
            EnterpriseOperationPlatformOrganizationPointManagerEnum::BIND_PACKAGE->value
        );
        $node = $this->findNodeByPermissionKey($tree, $bindPackagePermission);

        $this->assertIsArray($node);
        $this->assertSame('绑定套餐', $node['label'] ?? null);
        $this->assertSame('积分管理-绑定套餐', $node['full_label'] ?? null);
    }

    public function testGetPermissionTreeHidesEnterprisePlatformResourcesForNonPlatformOrganization(): void
    {
        $tree = $this->permission->getPermissionTree(false);

        $this->assertFalse($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(EnterpriseResourceEnum::PLATFORM_PRODUCT_MANAGE->value, 'query')
        ));
        $this->assertFalse($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(EnterpriseResourceEnum::PLATFORM_PRODUCT_ORDER->value, 'query')
        ));
        $this->assertFalse($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(
                EnterpriseResourceEnum::PLATFORM_ORGANIZATION_POINT_MANAGER->value,
                EnterpriseOperationPlatformOrganizationPointManagerEnum::LIST->value
            )
        ));
        $this->assertFalse($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(
                EnterpriseResourceEnum::PLATFORM_AI_CONTENT_AUDIT->value,
                EnterpriseOperationAiContentAuditEnum::LIST->value
            )
        ));
        $this->assertFalse($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(EnterpriseResourceEnum::PLATFORM_PROXY_SERVER->value, 'query')
        ));
    }

    public function testGetResourceModuleUsesMappedTagForEnterpriseResources(): void
    {
        $this->assertSame('平台套餐', $this->permission->getResourceModule(EnterpriseResourceEnum::PLATFORM_PRODUCT_MANAGE->value));
        $this->assertSame('平台套餐', $this->permission->getResourceModule(EnterpriseResourceEnum::PLATFORM_PRODUCT_ORDER->value));
        $this->assertSame('平台租户', $this->permission->getResourceModule(EnterpriseResourceEnum::PLATFORM_ORGANIZATION_POINT_MANAGER->value));
        $this->assertSame('平台管理', $this->permission->getResourceModule(EnterpriseResourceEnum::PLATFORM_AI_CONTENT_AUDIT->value));
        $this->assertSame('平台管理', $this->permission->getResourceModule(EnterpriseResourceEnum::PLATFORM_PROXY_SERVER->value));
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

    /**
     * @param array<int, mixed> $nodes
     * @return null|array<string, mixed>
     */
    private function findNodeByPermissionKey(array $nodes, string $permissionKey): ?array
    {
        foreach ($nodes as $node) {
            if (! is_array($node)) {
                continue;
            }

            if (($node['permission_key'] ?? '') === $permissionKey) {
                return $node;
            }

            $children = $node['children'] ?? [];
            if (is_array($children)) {
                $found = $this->findNodeByPermissionKey($children, $permissionKey);
                if ($found !== null) {
                    return $found;
                }
            }
        }

        return null;
    }
}
