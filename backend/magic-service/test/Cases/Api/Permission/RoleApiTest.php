<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Permission;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Kernel\MagicPermission;
use HyperfTest\Cases\Api\AbstractHttpTest;

/**
 * @internal
 */
class RoleApiTest extends AbstractHttpTest
{
    public const string CREATE_SUB_ADMIN_API = '/api/v1/admin/roles/sub-admins';

    public const string SUB_ADMIN_API = '/api/v1/admin/roles/sub-admins/';

    /**
     * 测试子管理员列表查询.
     */
    public function testGetSubAdminListAndById(): void
    {
        // === 测试 getSubAdminList ===
        $listResp = $this->get(self::CREATE_SUB_ADMIN_API, [], $this->getCommonHeaders());

        $this->assertIsArray($listResp);
        $this->assertEquals(1000, $listResp['code'] ?? null);
    }

    public function testCreateSubAdminSuccess(): void
    {
        // === 测试创建子管理员 ===
        $magicPermission = new MagicPermission();
        $testPermissions = [
            $magicPermission->buildPermission(MagicResourceEnum::ADMIN_AI_MODEL->value, MagicOperationEnum::EDIT->value),
            $magicPermission->buildPermission(MagicResourceEnum::ADMIN_AI_IMAGE->value, MagicOperationEnum::QUERY->value),
            $magicPermission->buildPermission(MagicResourceEnum::SAFE_SUB_ADMIN->value, MagicOperationEnum::EDIT->value),
        ];
        $requestData = [
            'name' => '测试子管理员角色',
            'status' => 1,
            'permissions' => $testPermissions,
            'user_ids' => ['usi_343adbdbe8a026226311c67bdea152ea', 'usi_71f7b56bec00b0cd9f9daba18caa7a4c'],
        ];

        $response = $this->post(
            self::CREATE_SUB_ADMIN_API,
            $requestData,
            $this->getCommonHeaders()
        );

        $this->assertIsArray($response);

        // 检查成功响应结构
        if (isset($response['code']) && $response['code'] === 1000) {
            $this->assertArrayHasKey('data', $response);
            $this->assertIsArray($response['data']);
            $this->assertArrayHasKey('id', $response['data']);
            $this->assertArrayHasKey('name', $response['data']);
            $this->assertEquals($requestData['name'], $response['data']['name']);
            $this->assertEquals($requestData['status'], $response['data']['status']);
        }
        // === 测试创建子管理员END ===

        // === 测试更新子管理员 ===
        $id = $response['data']['id'];

        $testPermissions = [
            $magicPermission->buildPermission(MagicResourceEnum::SAFE_SUB_ADMIN->value, MagicOperationEnum::EDIT->value),
            $magicPermission->buildPermission(MagicResourceEnum::ADMIN_AI_MODEL->value, MagicOperationEnum::QUERY->value),
        ];

        $requestData = [
            'name' => '更新的子管理员角色' . rand(100, 999),
            'status' => 0,
            'permissions' => $testPermissions,
            'user_ids' => ['usi_343adbdbe8a026226311c67bdea152ea'],
        ];

        $response = $this->put(
            self::SUB_ADMIN_API . $id,
            $requestData,
            $this->getCommonHeaders()
        );

        $this->assertIsArray($response);
        $this->assertEquals(1000, $response['code']);

        // 检查成功响应结构
        $this->assertArrayHasKey('data', $response);
        $this->assertIsArray($response['data']);
        $this->assertArrayHasKey('id', $response['data']);
        $this->assertArrayHasKey('name', $response['data']);
        $this->assertEquals($requestData['name'], $response['data']['name']);
        $this->assertEquals($requestData['status'], $response['data']['status']);
        // === 测试更新子管理员END ===

        // === 测试查询子管理员 ===
        $detailResp = $this->get(self::SUB_ADMIN_API . $id, [], $this->getCommonHeaders());
        // 断言详情接口响应结构与数据
        $this->assertIsArray($detailResp);
        $this->assertEquals(1000, $detailResp['code'] ?? null);

        $expectedDetailStructure = [
            'id' => '',
            'name' => '',
            'status' => 0,
            'permissions' => [],
            'user_ids' => [],
            'created_at' => null,
            'updated_at' => null,
        ];

        $this->assertArrayValueTypesEquals(
            $expectedDetailStructure,
            $detailResp['data'] ?? [],
            '子管理员详情接口响应结构不符合预期',
            false,
            false
        );

        // 核对数据内容
        $this->assertEquals($id, $detailResp['data']['id'] ?? null);
        $this->assertEquals($requestData['name'], $detailResp['data']['name'] ?? null);
        $this->assertEquals($requestData['status'], $detailResp['data']['status'] ?? null);

        // === 测试查询子管理员END ===

        // === 测试删除子管理员 ===
        // 调用删除接口
        $deleteResp = $this->delete(self::SUB_ADMIN_API . $id, [], $this->getCommonHeaders());
        $this->assertIsArray($deleteResp);
        $this->assertEquals(1000, $deleteResp['code']);

        // 再次查询应当返回角色不存在或空
        $detailResp = $this->get(self::SUB_ADMIN_API . $id, [], $this->getCommonHeaders());
        // 预期这里会返回错误码，具体根据业务而定，只要非1000即可
        $this->assertNotEquals(1000, $detailResp['code'] ?? null);
        // === 测试删除子管理员END ===
    }

    /**
     * 测试获取用户权限树接口.
     */
    public function testGetUserPermissionTree(): void
    {
        // 调用接口
        $response = $this->get(
            '/api/v1/permissions/me',
            [],
            $this->getCommonHeaders()
        );

        // 断言基础响应结构
        $this->assertIsArray($response);
        $this->assertEquals(1000, $response['code'] ?? null);

        // 断言 data 字段存在且为数组
        $this->assertArrayHasKey('data', $response);
        $this->assertIsArray($response['data']);

        // 如果 data 非空，简单校验节点结构
        if (! empty($response['data'])) {
            $this->assertArrayHasKey('permission_key', $response['data']);
        }
    }
}
