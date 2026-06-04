<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Kernel;

use App\Application\Kernel\Contract\MagicPermissionInterface;
use Hyperf\Contract\ConfigInterface;
use HyperfTest\HttpTestCase;

/**
 * @internal
 */
class PlatformPermissionTreeTest extends HttpTestCase
{
    private const string RESOURCE_PLATFORM_PRODUCT_MANAGE = 'platform.product.manage';

    private const string RESOURCE_PLATFORM_PRODUCT_ORDER = 'platform.product.order';

    private const string RESOURCE_PLATFORM_ORGANIZATION_POINT_MANAGER = 'platform.organization.point_manager';

    private const string RESOURCE_PLATFORM_AI_CONTENT_AUDIT = 'platform.ai.content_audit';

    private const string RESOURCE_PLATFORM_PROXY_SERVER = 'platform.setting.proxy_server';

    private const string OPERATION_BIND_PACKAGE = 'bind_package';

    private const string OPERATION_LIST = 'list';

    private const string OPERATION_RISK = 'risk';

    private MagicPermissionInterface $permission;

    private ConfigInterface $config;

    protected function setUp(): void
    {
        parent::setUp();
        $this->permission = di(MagicPermissionInterface::class);
        $this->config = di(ConfigInterface::class);

        $mapping = $this->config->get('permission_menu.resource_menu_mapping', []);
        if (! is_array($mapping) || ! isset($mapping[self::RESOURCE_PLATFORM_PRODUCT_MANAGE])) {
            self::markTestSkipped('Current runtime does not provide platform permission mappings.');
        }
    }

    public function testGetPermissionTreeContainsPlatformMappingsForPlatformOrganization(): void
    {
        $tree = $this->permission->getPermissionTree(true);

        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.platform_package.subscription_package'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.platform_package.order_management'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.platform_tenant.tenant_points'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.platform_console_management.content_audit'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.platform_console_management.proxy_server'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.platform_model.video_model'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.agent_enhancement.official_agent'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.agent_enhancement.skill_review'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.agent_enhancement.skill_market'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.agent_enhancement.employee_review'));
        $this->assertTrue($this->containsPermissionKey($tree, 'menu.platform_management.agent_enhancement.employee_market'));

        $this->assertTrue($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(self::RESOURCE_PLATFORM_PRODUCT_MANAGE, 'query')
        ));
        $this->assertTrue($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(self::RESOURCE_PLATFORM_PRODUCT_ORDER, 'query')
        ));
        $this->assertTrue($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(
                self::RESOURCE_PLATFORM_ORGANIZATION_POINT_MANAGER,
                self::OPERATION_BIND_PACKAGE
            )
        ));
        $this->assertTrue($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(
                self::RESOURCE_PLATFORM_AI_CONTENT_AUDIT,
                self::OPERATION_RISK
            )
        ));
        $this->assertTrue($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(self::RESOURCE_PLATFORM_PROXY_SERVER, 'edit')
        ));
    }

    public function testGetPermissionTreeUsesSplitAgentSkillResourcesWithoutCreatingInvalidOfficialEditPermission(): void
    {
        $tree = $this->permission->getPermissionTree(true);

        $platformTextModelQuery = $this->permission->buildPermission('platform.model.text', 'query');
        $platformVideoModelQuery = $this->permission->buildPermission('platform.model.video', 'query');
        $officialAgentQuery = $this->permission->buildPermission('platform.agent.official', 'query');
        $skillReviewQuery = $this->permission->buildPermission('platform.skill.review', 'query');
        $skillMarketQuery = $this->permission->buildPermission('platform.skill.market', 'query');
        $agentReviewQuery = $this->permission->buildPermission('platform.agent.review', 'query');
        $agentMarketQuery = $this->permission->buildPermission('platform.agent.market', 'query');
        $orderQuery = $this->permission->buildPermission(self::RESOURCE_PLATFORM_PRODUCT_ORDER, 'query');

        $this->assertSame(1, $this->countPermissionKey($tree, $platformTextModelQuery));
        $this->assertSame(1, $this->countPermissionKey($tree, $platformVideoModelQuery));
        $this->assertSame(1, $this->countPermissionKey($tree, $officialAgentQuery));
        $this->assertSame(1, $this->countPermissionKey($tree, $skillReviewQuery));
        $this->assertSame(1, $this->countPermissionKey($tree, $skillMarketQuery));
        $this->assertSame(1, $this->countPermissionKey($tree, $agentReviewQuery));
        $this->assertSame(1, $this->countPermissionKey($tree, $agentMarketQuery));
        $this->assertSame(0, $this->countPermissionKey($tree, 'platform.ai.skill_management.query'));
        $this->assertSame(0, $this->countPermissionKey($tree, 'platform.ai.agent_management.query'));
        $this->assertTrue($this->containsPermissionKey($tree, $orderQuery));
        $this->assertFalse($this->containsPermissionKey(
            $tree,
            self::RESOURCE_PLATFORM_PRODUCT_ORDER . '.edit'
        ));
        $this->assertFalse($this->containsPermissionKey($tree, 'platform.agent.official.edit'));
    }

    public function testGetPermissionTreeUsesTranslatedBindPackageOperationLabel(): void
    {
        $tree = $this->permission->getPermissionTree(true);
        $bindPackagePermission = $this->permission->buildPermission(
            self::RESOURCE_PLATFORM_ORGANIZATION_POINT_MANAGER,
            self::OPERATION_BIND_PACKAGE
        );
        $node = $this->findNodeByPermissionKey($tree, $bindPackagePermission);

        $this->assertIsArray($node);
        $this->assertSame('绑定套餐', $node['label'] ?? null);
        $this->assertSame('积分管理-绑定套餐', $node['full_label'] ?? null);
    }

    public function testGetPermissionTreeHidesPlatformResourcesForNonPlatformOrganization(): void
    {
        $tree = $this->permission->getPermissionTree(false);

        $this->assertFalse($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(self::RESOURCE_PLATFORM_PRODUCT_MANAGE, 'query')
        ));
        $this->assertFalse($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(self::RESOURCE_PLATFORM_PRODUCT_ORDER, 'query')
        ));
        $this->assertFalse($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(
                self::RESOURCE_PLATFORM_ORGANIZATION_POINT_MANAGER,
                self::OPERATION_LIST
            )
        ));
        $this->assertFalse($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(
                self::RESOURCE_PLATFORM_AI_CONTENT_AUDIT,
                self::OPERATION_LIST
            )
        ));
        $this->assertFalse($this->containsPermissionKey(
            $tree,
            $this->permission->buildPermission(self::RESOURCE_PLATFORM_PROXY_SERVER, 'query')
        ));
    }

    public function testGetResourceModuleUsesMappedTagForPlatformResources(): void
    {
        $this->assertSame('平台套餐', $this->permission->getResourceModule(self::RESOURCE_PLATFORM_PRODUCT_MANAGE));
        $this->assertSame('平台套餐', $this->permission->getResourceModule(self::RESOURCE_PLATFORM_PRODUCT_ORDER));
        $this->assertSame('平台租户', $this->permission->getResourceModule(self::RESOURCE_PLATFORM_ORGANIZATION_POINT_MANAGER));
        $this->assertSame('平台管理', $this->permission->getResourceModule(self::RESOURCE_PLATFORM_AI_CONTENT_AUDIT));
        $this->assertSame('平台管理', $this->permission->getResourceModule(self::RESOURCE_PLATFORM_PROXY_SERVER));
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
