<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Login;

use App\ErrorCode\AuthenticationErrorCode;
use HyperfTest\Cases\Api\AbstractHttpTest;

/**
 * @internal
 * 用户登录会话API测试
 */
class LoginApiTest extends AbstractHttpTest
{
    public const string API = '/api/v1/sessions';

    /**
     * 测试手机号密码登录.
     */
    public function testPhonePasswordLogin(): string
    {
        // 构造请求参数 - 手机号密码登录
        $requestData = [
            'state_code' => '+86',
            'phone' => '13812345678', // 测试环境中不存在的账号
            'password' => '123456',
            'type' => 'phone_password',
        ];

        // 发送POST请求
        $response = $this->json(self::API, $requestData, [
            'User-Agent' => 'PHPUnit Test',
            'Content-Type' => 'application/json',
            'Accept' => '*/*',
            'Connection' => 'keep-alive',
            'Cookie' => 'sl-session=UetTdUM44WeDs3Dd1UeJaQ==',
        ]);
        $expectData = [
            'code' => 1000,
            'message' => '请求成功',
            'data' => [
                'access_token' => 'magic:xxx',
                'bind_phone' => true,
                'is_perfect_password' => false,
                'user_info' => [
                    'id' => 'xxxxx',
                    'real_name' => '管理员1',
                    'avatar' => 'default_avatar',
                    'description' => '',
                    'position' => '',
                    'mobile' => '13812345678',
                    'state_code' => '+86',
                ],
            ],
        ];
        $this->assertSame(1000, $response['code']);
        $this->assertArrayValueTypesEquals($expectData, $response);

        return $response['data']['access_token'];
    }

    /**
     * 测试手机号不存在.
     */
    public function testPhoneNotExists(): void
    {
        // 构造请求参数 - 测试手机号不存在
        $requestData = [
            'state_code' => '+86',
            'phone' => '19999999999', // 使用一个确定不存在的手机号
            'password' => '123456',
            'type' => 'phone_password',
        ];

        // 发送POST请求
        $response = $this->json(self::API, $requestData);
        // 期望手机号不存在时返回相应的错误码和消息
        $expectData = [
            'code' => AuthenticationErrorCode::AccountNotFound->value,
        ];

        $this->assertArrayEquals($expectData, $response);
    }

    /**
     * 测试有效的 token 验证
     * @depends testPhonePasswordLogin
     */
    public function testValidTokenVerification(string $authorization): void
    {
        $response = $this->json('/api/v1/tokens/verify', [
            'authorization' => $authorization,
            'teamshare_login_code' => '',
        ]);
        $this->assertSame(1000, $response['code']);
        $this->assertArrayValueTypesEquals($response, [
            'code' => 1000,
            'message' => 'ok',
            'data' => [
                [
                    'magic_id' => '1',
                    'magic_user_id' => '1',
                    'magic_organization_code' => '1',
                    'teamshare_organization_code' => '1',
                    'teamshare_user_id' => '1',
                ],
            ],
        ]);
    }

    /**
     * 测试无效的 token 验证
     */
    public function testInvalidTokenVerification(): void
    {
        $requestData = [
            'teamshare_login_code' => '',
            'authorization' => 'magic:invalid_token',
        ];

        $response = $this->json('/api/v1/tokens/verify', $requestData);

        $expectData = [
            'code' => 3103,
            'message' => 'authorization 不合法',
            'data' => null,
        ];

        $this->assertArrayValueTypesEquals($expectData, $response);
    }
}
