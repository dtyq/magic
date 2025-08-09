<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Permission;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Kernel\MagicPermission;
use Hyperf\Codec\Json;
use HyperfTest\Cases\Api\AbstractHttpTest;

/**
 * @internal
 */
class RoleApiTest extends AbstractHttpTest
{
    public const string CREATE_SUB_ADMIN_API = '/api/v1/roles/sub-admins';

    public const string UPDATE_SUB_ADMIN_API = '/api/v1/roles/sub-admins/';

    public function testCreateSubAdminSuccess(): void
    {
        // === 测试创建子管理员 ===
        $magicPermission = new MagicPermission();
        $testPermissions = [
            $magicPermission->buildPermission(MagicResourceEnum::ADMIN_AI_MODEL->value,MagicOperationEnum::EDIT->value),
            $magicPermission->buildPermission(MagicResourceEnum::ADMIN_AI_IMAGE->value,MagicOperationEnum::QUERY->value),
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
            $magicPermission->buildPermission(MagicResourceEnum::ADMIN_AI_MODEL->value,MagicOperationEnum::QUERY->value),
        ];

        $requestData = [
            'name' => '更新的子管理员角色'.rand(100,999),
            'status' => 0,
            'permissions' => $testPermissions,
            'user_ids' => ['usi_343adbdbe8a026226311c67bdea152ea'],
        ];

        $response = $this->put(
            self::UPDATE_SUB_ADMIN_API . $id,
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

        // === 测试查询子管理员END ===
    }

}
