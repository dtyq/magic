<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Admin\BillingManager;

use HyperfTest\Cases\BaseTest;

/**
 * 计费管理 API 测试类.
 * @internal
 * @coversNothing
 */
class BillingManagerApiTest extends BaseTest
{
    private string $baseUri = '/api/v1/super-agent/admin/billing-manager';

    /**
     * 测试获取组织列表 - 基本查询.
     */
    public function testGetOrganizationListWithBasicQuery(): void
    {
        $headers = $this->getCommonHeaders();
        $query = [
            'page' => 1,
            'page_size' => 10,
        ];

        $response = $this->get($this->baseUri . '/organizations?' . http_build_query($query), [], $headers);

        $this->assertIsArray($response);
        $this->assertArrayHasKey('code', $response);
        $this->assertSame(1000, $response['code']);
        $this->assertArrayHasKey('data', $response);

        $data = $response['data'];
        $this->assertArrayHasKey('total', $data);
        $this->assertArrayHasKey('list', $data);
        $this->assertIsArray($data['list']);

        // 验证列表项的结构
        if (! empty($data['list'])) {
            $firstItem = $data['list'][0];
            $expectedStructure = [
                'organization_code' => '',
                'organization_name' => '',
                'creator_name' => '',
                'creator_user_id' => '',
                'creator_phone' => '',
                'created_time' => '',
                'invitation_code' => '',
                'current_plan' => '',
                'balance' => 0,
                'used_points' => 0,
                'current_plan_product_name' => [],
            ];

            $this->assertArrayValueTypesEquals(
                $expectedStructure,
                $firstItem,
                '组织列表项结构验证'
            );
        }
    }

    /**
     * 测试获取组织列表 - 按组织名称搜索.
     */
    public function testGetOrganizationListWithOrganizationName(): void
    {
        $headers = $this->getCommonHeaders();
        $query = [
            'page' => 1,
            'page_size' => 10,
            'organization_name' => 'test',
        ];

        $response = $this->get($this->baseUri . '/organizations?' . http_build_query($query), [], $headers);

        $this->assertIsArray($response);
        $this->assertArrayHasKey('code', $response);
        $this->assertSame(1000, $response['code']);
        $this->assertArrayHasKey('data', $response);

        $data = $response['data'];
        $this->assertArrayHasKey('total', $data);
        $this->assertArrayHasKey('list', $data);
        $this->assertIsArray($data['list']);
    }

    /**
     * 测试获取组织列表 - 按 magic_id 搜索.
     */
    public function testGetOrganizationListWithMagicId(): void
    {
        $headers = $this->getCommonHeaders();
        $query = [
            'page' => 1,
            'page_size' => 10,
            'magic_id' => 'test_magic_id',
        ];

        $response = $this->get($this->baseUri . '/organizations?' . http_build_query($query), [], $headers);

        $this->assertIsArray($response);
        $this->assertArrayHasKey('code', $response);
        $this->assertArrayHasKey('data', $response);

        $data = $response['data'];
        $this->assertArrayHasKey('total', $data);
        $this->assertArrayHasKey('list', $data);
        $this->assertIsArray($data['list']);
    }

    /**
     * 测试获取组织列表 - 按创建者手机号搜索.
     */
    public function testGetOrganizationListWithPhone(): void
    {
        $headers = $this->getCommonHeaders();
        $query = [
            'page' => 1,
            'page_size' => 10,
            'phone' => '13800138000',
        ];

        $response = $this->get($this->baseUri . '/organizations?' . http_build_query($query), [], $headers);

        $this->assertIsArray($response);
        $this->assertArrayHasKey('code', $response);
        $this->assertArrayHasKey('data', $response);

        $data = $response['data'];
        $this->assertArrayHasKey('total', $data);
        $this->assertArrayHasKey('list', $data);
        $this->assertIsArray($data['list']);
    }

    /**
     * 测试获取组织列表 - 组合条件搜索.
     */
    public function testGetOrganizationListWithMultipleConditions(): void
    {
        $headers = $this->getCommonHeaders();
        $query = [
            'page' => 1,
            'page_size' => 20,
            'organization_name' => 'test',
            'creator_phone' => '13800138000',
        ];

        $response = $this->get($this->baseUri . '/organizations?' . http_build_query($query), [], $headers);

        $this->assertIsArray($response);
        $this->assertArrayHasKey('code', $response);
        $this->assertSame(1000, $response['code']);
        $this->assertArrayHasKey('data', $response);

        $data = $response['data'];
        $this->assertArrayHasKey('total', $data);
        $this->assertArrayHasKey('list', $data);
        $this->assertIsArray($data['list']);
    }

    /**
     * 测试获取组织列表 - 分页功能.
     */
    public function testGetOrganizationListPagination(): void
    {
        $headers = $this->getCommonHeaders();

        // 第一页
        $query1 = [
            'page' => 1,
            'page_size' => 5,
        ];
        $response1 = $this->get($this->baseUri . '/organizations?' . http_build_query($query1), [], $headers);

        $this->assertIsArray($response1);
        $this->assertArrayHasKey('code', $response1);
        $this->assertSame(1000, $response1['code']);

        // 第二页
        $query2 = [
            'page' => 2,
            'page_size' => 5,
        ];
        $response2 = $this->get($this->baseUri . '/organizations?' . http_build_query($query2), [], $headers);

        $this->assertIsArray($response2);
        $this->assertArrayHasKey('code', $response2);
        $this->assertSame(1000, $response2['code']);

        // 验证两页数据不同（如果有足够数据）
        if (! empty($response1['data']['list']) && ! empty($response2['data']['list'])) {
            $firstPageFirstItem = $response1['data']['list'][0] ?? null;
            $secondPageFirstItem = $response2['data']['list'][0] ?? null;

            if ($firstPageFirstItem && $secondPageFirstItem) {
                $this->assertNotEquals(
                    $firstPageFirstItem['organization_code'],
                    $secondPageFirstItem['organization_code'],
                    '不同页的数据应该不同'
                );
            }
        }
    }

    /**
     * 测试获取组织列表 - 无参数（使用默认值）.
     */
    public function testGetOrganizationListWithDefaultParams(): void
    {
        $headers = $this->getCommonHeaders();

        $response = $this->get($this->baseUri . '/organizations', [], $headers);

        $this->assertIsArray($response);
        $this->assertArrayHasKey('code', $response);
        $this->assertSame(1000, $response['code']);
        $this->assertArrayHasKey('data', $response);

        $data = $response['data'];
        $this->assertArrayHasKey('total', $data);
        $this->assertArrayHasKey('list', $data);
        $this->assertIsArray($data['list']);
    }
}
