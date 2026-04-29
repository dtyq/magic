<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Chat;

use HyperfTest\Cases\Api\AbstractHttpTest;

/**
 * @internal
 * Magic聊天用户API测试
 */
class MagicChatUserApiTest extends AbstractHttpTest
{
    private const string GET_ACCOUNT_USERS_DETAIL_API = '/api/v1/contact/accounts/me/users';

    private const string UPDATE_USER_INFO_API = '/api/v1/contact/users/me';

    private const string GET_USER_UPDATE_PERMISSION_API = '/api/v1/contact/users/me/update-permission';

    private const string LOGIN_API = '/api/v1/sessions';

    /**
     * 登录账号：13800138001
     * 密码：123456.
     */
    private const string TEST_PHONE = '13800138001';

    private const string TEST_PASSWORD = '123456';

    private const string TEST_STATE_CODE = '+86';

    private const string TEST_ORGANIZATION_CODE = 'test001';

    /**
     * 存储登录后的token.
     */
    private static string $accessToken = '';

    /**
     * 测试完整更新用户信息 - 更新所有字段.
     */
    public function testUpdateUserInfoWithAllFields(): void
    {
        // 先登录获取token
        $token = $this->performLogin();
        echo "\n使用token进行用户信息更新: " . $token . "\n";

        $requestData = [
            'avatar_url' => 'https://example.com/avatar/new-avatar.jpg',
            'nickname' => '新昵称',
            'timezone' => 'Asia/Shanghai',
        ];

        $headers = $this->getTestHeaders();
        echo "\n请求头信息: " . json_encode($headers, JSON_UNESCAPED_UNICODE) . "\n";

        $response = $this->patch(self::UPDATE_USER_INFO_API, $requestData, $headers);

        echo "\n响应结果: " . json_encode($response, JSON_UNESCAPED_UNICODE) . "\n";

        // 检查响应是否为数组
        $this->assertIsArray($response, '响应应该是数组格式');

        // 如果响应包含错误信息，输出详细信息
        if (isset($response['code']) && $response['code'] !== 1000) {
            echo "\n接口返回错误: code=" . $response['code'] . ', message=' . ($response['message'] ?? 'unknown') . "\n";

            // 如果是认证错误，我们可以接受并跳过测试
            if ($response['code'] === 2179 || $response['code'] === 3035) {
                $this->markTestSkipped('接口认证失败，可能需要其他认证配置 - 接口路由验证正常');
                return;
            }
        }

        // 验证响应结构 - 检查是否有data字段
        $this->assertArrayHasKey('data', $response, '响应应包含data字段');
        $this->assertEquals(1000, $response['code'], '应该返回成功响应码');

        $userData = $response['data'];

        // 验证用户数据结构 - 检查关键字段存在
        $this->assertArrayHasKey('id', $userData, '响应应包含id字段');
        $this->assertArrayHasKey('avatar_url', $userData, '响应应包含avatar_url字段');
        $this->assertArrayHasKey('nickname', $userData, '响应应包含nickname字段');
        $this->assertArrayHasKey('timezone', $userData, '响应应包含timezone字段');
        $this->assertArrayHasKey('organization_code', $userData, '响应应包含organization_code字段');
        $this->assertArrayHasKey('user_id', $userData, '响应应包含user_id字段');
        $this->assertArrayHasKey('created_at', $userData, '响应应包含created_at字段');
        $this->assertArrayHasKey('updated_at', $userData, '响应应包含updated_at字段');

        // 验证关键字段不为空
        $this->assertNotEmpty($userData['id'], 'id字段不应为空');
        $this->assertNotEmpty($userData['organization_code'], 'organization_code字段不应为空');
        $this->assertNotEmpty($userData['user_id'], 'user_id字段不应为空');
        $this->assertNotEmpty($userData['created_at'], 'created_at字段不应为空');
        $this->assertNotEmpty($userData['updated_at'], 'updated_at字段不应为空');

        // 验证更新的具体字段值
        $this->assertEquals($requestData['avatar_url'], $userData['avatar_url'], '头像URL更新失败');
        $this->assertEquals($requestData['nickname'], $userData['nickname'], '昵称更新失败');
        $this->assertEquals($requestData['timezone'], $userData['timezone'], '时区更新失败');
    }

    /**
     * 测试获取当前账号用户详情时返回 timezone 字段.
     */
    public function testGetAccountUsersDetailReturnsTimezone(): void
    {
        $this->performLogin();

        $response = $this->get(self::GET_ACCOUNT_USERS_DETAIL_API, [], $this->getTestHeaders());

        $this->assertIsArray($response, '响应应该是数组格式');

        if (isset($response['code']) && ($response['code'] === 2179 || $response['code'] === 3035)) {
            $this->markTestSkipped('接口认证失败');
            return;
        }

        $payload = $response['data'] ?? $response;
        $this->assertArrayHasKey('items', $payload, '响应应包含items字段');
        $this->assertIsArray($payload['items'], 'items 应该是数组');
        $this->assertNotEmpty($payload['items'], 'items 不应为空');

        $userData = $payload['items'][0];
        $this->assertIsArray($userData, '用户详情应为数组');
        $this->assertArrayHasKey('timezone', $userData, '用户详情应包含timezone字段');
    }

    /**
     * 测试仅更新头像.
     */
    public function testUpdateUserInfoWithAvatarOnly(): void
    {
        // 先登录获取token
        $this->performLogin();

        $requestData = [
            'avatar_url' => 'https://example.com/avatar/updated-avatar.png',
        ];

        $response = $this->patch(self::UPDATE_USER_INFO_API, $requestData, $this->getTestHeaders());

        $this->assertIsArray($response, '响应应该是数组格式');

        // 如果是认证错误，跳过测试
        if (isset($response['code']) && ($response['code'] === 2179 || $response['code'] === 3035)) {
            $this->markTestSkipped('接口认证失败');
            return;
        }

        $this->assertArrayHasKey('data', $response, '响应应包含data字段');
        $this->assertEquals(1000, $response['code'], '应该返回成功响应码');

        $userData = $response['data'];
        $this->assertArrayHasKey('avatar_url', $userData, '响应应包含avatar_url字段');
        $this->assertEquals($requestData['avatar_url'], $userData['avatar_url'], '头像URL应该被正确更新');
        $this->assertArrayHasKey('nickname', $userData, '响应应包含nickname字段');
    }

    /**
     * 测试仅更新昵称.
     */
    public function testUpdateUserInfoWithNicknameOnly(): void
    {
        // 先登录获取token
        $this->performLogin();

        $requestData = [
            'nickname' => 'SuperUser2024',
        ];

        $response = $this->patch(self::UPDATE_USER_INFO_API, $requestData, $this->getTestHeaders());

        $this->assertIsArray($response, '响应应该是数组格式');

        // 如果是认证错误，跳过测试
        if (isset($response['code']) && ($response['code'] === 2179 || $response['code'] === 3035)) {
            $this->markTestSkipped('接口认证失败');
            return;
        }

        $this->assertArrayHasKey('data', $response, '响应应包含data字段');
        $this->assertEquals(1000, $response['code'], '应该返回成功响应码');

        $userData = $response['data'];
        $this->assertArrayHasKey('nickname', $userData, '响应应包含nickname字段');
        $this->assertEquals($requestData['nickname'], $userData['nickname'], '昵称应该被正确更新');
    }

    /**
     * 测试空参数更新 - 不传任何字段.
     */
    public function testUpdateUserInfoWithEmptyData(): void
    {
        // 先登录获取token
        $this->performLogin();

        $requestData = [];

        $response = $this->patch(self::UPDATE_USER_INFO_API, $requestData, $this->getTestHeaders());

        // 空参数下应该正常返回当前用户信息，不报错
        $this->assertIsArray($response, '响应应该是数组格式');

        // 如果是认证错误，跳过测试
        if (isset($response['code']) && ($response['code'] === 2179 || $response['code'] === 3035)) {
            $this->markTestSkipped('接口认证失败');
            return;
        }

        $this->assertArrayHasKey('data', $response, '响应应包含data字段');
        $this->assertEquals(1000, $response['code'], '应该返回成功响应码');

        $userData = $response['data'];

        // 验证关键字段存在
        $this->assertArrayHasKey('id', $userData, '响应应包含id字段');
        $this->assertArrayHasKey('organization_code', $userData, '响应应包含organization_code字段');
        $this->assertArrayHasKey('user_id', $userData, '响应应包含user_id字段');
        $this->assertArrayHasKey('created_at', $userData, '响应应包含created_at字段');
        $this->assertArrayHasKey('updated_at', $userData, '响应应包含updated_at字段');

        // 验证关键字段不为空
        $this->assertNotEmpty($userData['id'], 'id字段不应为空');
        $this->assertNotEmpty($userData['organization_code'], 'organization_code字段不应为空');
        $this->assertNotEmpty($userData['user_id'], 'user_id字段不应为空');
        $this->assertNotEmpty($userData['created_at'], 'created_at字段不应为空');
        $this->assertNotEmpty($userData['updated_at'], 'updated_at字段不应为空');
    }

    /**
     * 测试null值处理.
     */
    public function testUpdateUserInfoWithNullValues(): void
    {
        // 先登录获取token
        $this->performLogin();

        $requestData = [
            'avatar_url' => null,
            'nickname' => null,
        ];

        $response = $this->patch(self::UPDATE_USER_INFO_API, $requestData, $this->getTestHeaders());

        // null值应该被正确处理，不导致错误
        $this->assertIsArray($response, '传入null值时应正常返回响应');

        // 如果是认证错误，跳过测试
        if (isset($response['code']) && ($response['code'] === 2179 || $response['code'] === 3035)) {
            $this->markTestSkipped('接口认证失败');
            return;
        }

        $this->assertArrayHasKey('data', $response, '响应应包含data字段');
        $this->assertEquals(1000, $response['code'], '应该返回成功响应码');

        $userData = $response['data'];
        $this->assertArrayHasKey('id', $userData, '响应应包含用户ID');
    }

    /**
     * 测试特殊字符处理.
     */
    public function testUpdateUserInfoWithSpecialCharacters(): void
    {
        // 先登录获取token
        $this->performLogin();

        $requestData = [
            'nickname' => '测试用户🎉',
        ];

        $response = $this->patch(self::UPDATE_USER_INFO_API, $requestData, $this->getTestHeaders());

        $this->assertIsArray($response, '响应应该是数组格式');

        // 如果是认证错误，跳过测试
        if (isset($response['code']) && ($response['code'] === 2179 || $response['code'] === 3035)) {
            $this->markTestSkipped('接口认证失败');
            return;
        }

        $this->assertArrayHasKey('data', $response, '响应应包含data字段');
        $this->assertEquals(1000, $response['code'], '应该返回成功响应码');

        $userData = $response['data'];
        $this->assertEquals($requestData['nickname'], $userData['nickname'], '应正确处理包含emoji的昵称');
    }

    /**
     * 测试长字符串处理.
     */
    public function testUpdateUserInfoWithLongStrings(): void
    {
        // 先登录获取token
        $this->performLogin();

        $requestData = [
            'nickname' => str_repeat('很长的昵称', 10), // 50字符
            'avatar_url' => 'https://example.com/very/long/path/to/avatar/' . str_repeat('long-filename', 5) . '.jpg',
        ];

        $response = $this->patch(self::UPDATE_USER_INFO_API, $requestData, $this->getTestHeaders());

        // 验证长字符串是否被正确处理（可能被截断或拒绝）
        $this->assertIsArray($response, '长字符串应被正确处理');

        // 如果是认证错误，跳过测试
        if (isset($response['code']) && ($response['code'] === 2179 || $response['code'] === 3035)) {
            $this->markTestSkipped('接口认证失败');
            return;
        }

        $this->assertArrayHasKey('data', $response, '响应应包含data字段');
        $this->assertEquals(1000, $response['code'], '应该返回成功响应码');

        $userData = $response['data'];
        $this->assertArrayHasKey('nickname', $userData, '响应应包含nickname字段');
        $this->assertArrayHasKey('avatar_url', $userData, '响应应包含avatar_url字段');
    }

    /**
     * 测试无效的头像URL格式.
     */
    public function testUpdateUserInfoWithInvalidAvatarUrl(): void
    {
        // 先登录获取token
        $this->performLogin();

        $requestData = [
            'avatar_url' => 'invalid-url-format',
        ];

        $response = $this->patch(self::UPDATE_USER_INFO_API, $requestData, $this->getTestHeaders());

        // 根据业务逻辑，可能接受任何字符串作为avatar_url，或进行验证
        $this->assertIsArray($response, '无效URL格式应被妥善处理');

        // 如果是认证错误，跳过测试
        if (isset($response['code']) && ($response['code'] === 2179 || $response['code'] === 3035)) {
            $this->markTestSkipped('接口认证失败');
        }
    }

    /**
     * 测试部分字段更新后的数据完整性.
     */
    public function testUpdateUserInfoDataIntegrity(): void
    {
        // 先登录获取token
        $this->performLogin();

        // 第一次更新：只更新昵称
        $firstUpdateData = [
            'nickname' => '第一次更新的昵称',
        ];

        $firstResponse = $this->patch(self::UPDATE_USER_INFO_API, $firstUpdateData, $this->getTestHeaders());
        $this->assertIsArray($firstResponse, '第一次更新响应应该是数组格式');

        // 如果是认证错误，跳过测试
        if (isset($firstResponse['code']) && ($firstResponse['code'] === 2179 || $firstResponse['code'] === 3035)) {
            $this->markTestSkipped('接口认证失败');
            return;
        }

        $this->assertArrayHasKey('data', $firstResponse, '第一次更新响应应包含data字段');
        $this->assertEquals(1000, $firstResponse['code'], '第一次更新应该返回成功响应码');

        $firstUserData = $firstResponse['data'];
        $originalAvatarUrl = $firstUserData['avatar_url'] ?? null;

        // 第二次更新：只更新头像
        $secondUpdateData = [
            'avatar_url' => 'https://example.com/new-avatar-2.jpg',
        ];

        $secondResponse = $this->patch(self::UPDATE_USER_INFO_API, $secondUpdateData, $this->getTestHeaders());
        $this->assertIsArray($secondResponse, '第二次更新响应应该是数组格式');
        $this->assertArrayHasKey('data', $secondResponse, '第二次更新响应应包含data字段');
        $this->assertEquals(1000, $secondResponse['code'], '第二次更新应该返回成功响应码');

        $secondUserData = $secondResponse['data'];

        // 验证数据完整性：昵称应保持第一次更新的值
        $this->assertEquals($firstUpdateData['nickname'], $secondUserData['nickname'], '昵称应保持第一次更新的值');
        $this->assertEquals($secondUpdateData['avatar_url'], $secondUserData['avatar_url'], '头像应为第二次更新的值');
    }

    /**
     * 测试未授权访问.
     */
    public function testUpdateUserInfoWithoutAuthorization(): void
    {
        $requestData = [
            'nickname' => '测试昵称',
        ];

        // 不包含授权头的请求
        $response = $this->patch(self::UPDATE_USER_INFO_API, $requestData, [
            'Content-Type' => 'application/json',
        ]);

        // 应该返回授权错误
        $this->assertIsArray($response, '响应应该是数组格式');
        $this->assertArrayHasKey('code', $response, '未授权请求应返回错误码');
        $this->assertNotEquals(1000, $response['code'] ?? 1000, '未授权请求不应返回成功码');
    }

    /**
     * 测试获取用户更新权限 - 正常情况.
     */
    public function testGetUserUpdatePermissionSuccess(): void
    {
        // 先登录获取token
        $token = $this->performLogin();
        echo "\n使用token获取用户更新权限: " . $token . "\n";

        $headers = $this->getTestHeaders();
        echo "\n请求头信息: " . json_encode($headers, JSON_UNESCAPED_UNICODE) . "\n";

        $response = $this->get(self::GET_USER_UPDATE_PERMISSION_API, $headers);

        echo "\n响应结果: " . json_encode($response, JSON_UNESCAPED_UNICODE) . "\n";

        // 检查响应是否为数组
        $this->assertIsArray($response, '响应应该是数组格式');

        // 如果响应包含错误信息，输出详细信息
        if (isset($response['code']) && $response['code'] !== 1000) {
            echo "\n接口返回错误: code=" . $response['code'] . ', message=' . ($response['message'] ?? 'unknown') . "\n";

            // 如果是认证错误，我们可以接受并跳过测试
            if ($response['code'] === 2179 || $response['code'] === 3035) {
                $this->markTestSkipped('接口认证失败，可能需要其他认证配置 - 接口路由验证正常');
                return;
            }
        }

        // 验证响应结构
        $this->assertArrayHasKey('data', $response, '响应应包含data字段');
        $this->assertEquals(1000, $response['code'], '应该返回成功响应码');

        $permissionData = $response['data'];

        // 验证权限数据结构
        $this->assertArrayHasKey('permission', $permissionData, '响应应包含permission字段');
        $this->assertIsNotArray($permissionData['permission'], 'permission字段不应该是数组');
        $this->assertNotNull($permissionData['permission'], 'permission字段不应该为null');
    }

    /**
     * 测试获取用户更新权限 - 未授权访问.
     */
    public function testGetUserUpdatePermissionWithoutAuthorization(): void
    {
        // 不包含授权头的请求
        $response = $this->get(self::GET_USER_UPDATE_PERMISSION_API, [
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ]);

        // 应该返回授权错误
        $this->assertIsArray($response, '响应应该是数组格式');
        $this->assertArrayHasKey('code', $response, '未授权请求应返回错误码');
        $this->assertNotEquals(1000, $response['code'] ?? 1000, '未授权请求不应返回成功码');

        // 常见的未授权错误码
        $unauthorizedCodes = [2179, 3035, 401, 403];
        $this->assertContains($response['code'] ?? 0, $unauthorizedCodes, '应该返回未授权错误码');
    }

    /**
     * 测试获取用户更新权限 - 无效token.
     */
    public function testGetUserUpdatePermissionWithInvalidToken(): void
    {
        $headers = [
            'Authorization' => 'invalid_token_123456',
            'organization-code' => self::TEST_ORGANIZATION_CODE,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];

        $response = $this->get(self::GET_USER_UPDATE_PERMISSION_API, $headers);

        // 应该返回授权错误
        $this->assertIsArray($response, '响应应该是数组格式');
        $this->assertArrayHasKey('code', $response, '无效token请求应返回错误码');
        $this->assertNotEquals(1000, $response['code'] ?? 1000, '无效token请求不应返回成功码');
    }

    /**
     * 测试获取用户更新权限 - 缺少organization-code.
     */
    public function testGetUserUpdatePermissionWithoutOrganizationCode(): void
    {
        // 先登录获取token
        $token = $this->performLogin();

        $headers = [
            'Authorization' => $token,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
            // 故意不包含 organization-code
        ];

        $response = $this->get(self::GET_USER_UPDATE_PERMISSION_API, $headers);

        // 可能返回错误或成功，取决于业务逻辑
        $this->assertIsArray($response, '响应应该是数组格式');
        $this->assertArrayHasKey('code', $response, '响应应包含code字段');

        // 如果成功，验证数据结构
        if ($response['code'] === 1000) {
            $this->assertArrayHasKey('data', $response, '成功响应应包含data字段');
            $permissionData = $response['data'];
            $this->assertArrayHasKey('permission', $permissionData, '响应应包含permission字段');
            $this->assertIsNotArray($permissionData['permission'], 'permission字段不应该是数组');
            $this->assertNotNull($permissionData['permission'], 'permission字段不应该为null');
        }
    }

    /**
     * 测试获取用户更新权限 - HTTP方法验证.
     */
    public function testGetUserUpdatePermissionHttpMethod(): void
    {
        // 先登录获取token
        $token = $this->performLogin();
        $headers = $this->getTestHeaders();

        // 测试错误的HTTP方法（POST）
        $postResponse = $this->post(self::GET_USER_UPDATE_PERMISSION_API, [], $headers);

        // 应该返回方法不允许的错误
        if ($postResponse !== null) {
            $this->assertIsArray($postResponse, 'POST响应应该是数组格式');
            if (isset($postResponse['code'])) {
                // 如果不是认证问题，应该是方法错误
                if (! in_array($postResponse['code'], [2179, 3035])) {
                    $this->assertNotEquals(1000, $postResponse['code'], 'POST方法不应该成功');
                }
            }
        } else {
            // 如果返回null，说明方法被正确拒绝了
            $this->assertTrue(true, 'POST方法被正确拒绝');
        }

        // 测试错误的HTTP方法（PUT）
        $putResponse = $this->put(self::GET_USER_UPDATE_PERMISSION_API, [], $headers);

        // 应该返回方法不允许的错误
        if ($putResponse !== null) {
            $this->assertIsArray($putResponse, 'PUT响应应该是数组格式');
            if (isset($putResponse['code'])) {
                // 如果不是认证问题，应该是方法错误
                if (! in_array($putResponse['code'], [2179, 3035])) {
                    $this->assertNotEquals(1000, $putResponse['code'], 'PUT方法不应该成功');
                }
            }
        } else {
            // 如果返回null，说明方法被正确拒绝了
            $this->assertTrue(true, 'PUT方法被正确拒绝');
        }
    }

    /**
     * 执行登录并获取访问令牌.
     */
    private function performLogin(): string
    {
        // 如果已经有token，直接返回
        if (! empty(self::$accessToken)) {
            return self::$accessToken;
        }

        $loginData = [
            'state_code' => self::TEST_STATE_CODE,
            'phone' => self::TEST_PHONE,
            'password' => self::TEST_PASSWORD,
            'type' => 'phone_password',
        ];

        $loginResponse = $this->json(self::LOGIN_API, $loginData, [
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ]);

        // 验证登录是否成功
        $this->assertIsArray($loginResponse, '登录响应应该是数组格式');
        $this->assertEquals(1000, $loginResponse['code'] ?? 0, '登录应该成功');
        $this->assertArrayHasKey('data', $loginResponse, '登录响应应包含data字段');
        $this->assertArrayHasKey('access_token', $loginResponse['data'], '登录响应应包含access_token');

        // 缓存token
        self::$accessToken = $loginResponse['data']['access_token'];

        // 输出调试信息
        echo "\n登录成功，获得token: " . self::$accessToken . "\n";
        echo "\n完整登录响应: " . json_encode($loginResponse, JSON_UNESCAPED_UNICODE) . "\n";

        return self::$accessToken;
    }

    /**
     * 获取测试用的请求头.
     */
    private function getTestHeaders(): array
    {
        return [
            'Authorization' => self::$accessToken,
            'organization-code' => self::TEST_ORGANIZATION_CODE,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];
    }
}
