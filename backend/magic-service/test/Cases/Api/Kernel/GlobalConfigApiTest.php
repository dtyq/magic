<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Kernel;

use HyperfTest\Cases\Api\AbstractHttpTest;

/**
 * @internal
 * @coversNothing
 */
class GlobalConfigApiTest extends AbstractHttpTest
{
    private string $url = '/api/v1/settings/global';

    public function testGetGlobalConfigDefault(): void
    {
        $response = $this->get($this->url, [], $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $data = $response['data'];
        $this->assertArrayValueTypesEquals([
            'is_maintenance' => false,
            'maintenance_description' => '',
        ], $data, '默认全局配置结构不符', false, true);
    }

    public function testUpdateGlobalConfig(): void
    {
        $payload = [
            'is_maintenance' => true,
            'maintenance_description' => 'unit test maintenance',
        ];

        $putResponse = $this->put($this->url, $payload, $this->getCommonHeaders());
        $this->assertSame(1000, $putResponse['code']);
        $putData = $putResponse['data'];
        $this->assertArrayEquals($payload, $putData, 'PUT 返回数据不一致');

        // 再次 GET 验证缓存及持久化
        $getResponse = $this->get($this->url, [], $this->getCommonHeaders());
        $this->assertSame(1000, $getResponse['code']);
        $getData = $getResponse['data'];
        $this->assertArrayEquals($payload, $getData, 'GET 返回数据与预期不符');
    }

    public function testGetGlobalConfigWithPlatformSettings(): void
    {
        // 首先设置平台设置
        $platformPayload = [
            'logo_zh_url' => 'https://example.com/logo_zh.png',
            'logo_en_url' => 'https://example.com/logo_en.png',
            'favicon_url' => 'https://example.com/favicon.ico',
            'default_language' => 'zh_CN',
            'name_i18n' => [
                'zh_CN' => '测试平台',
                'en_US' => 'Test Platform',
            ],
        ];

        // 通过平台设置接口设置
        $this->put('/api/v1/platform/setting', $platformPayload, $this->getCommonHeaders());

        // 获取全局配置，应该包含平台设置
        $response = $this->get($this->url, [], $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $data = $response['data'];

        // 验证包含维护模式配置
        $this->assertArrayHasKey('is_maintenance', $data);
        $this->assertArrayHasKey('maintenance_description', $data);

        // 验证包含平台设置
        $this->assertArrayHasKey('logo', $data);
        $this->assertArrayHasKey('favicon', $data);
        $this->assertArrayHasKey('default_language', $data);

        // 验证平台设置的值
        if (isset($data['logo']['zh_CN']['url'])) {
            $this->assertSame('https://example.com/logo_zh.png', $data['logo']['zh_CN']['url']);
        }
        if (isset($data['logo']['en_US']['url'])) {
            $this->assertSame('https://example.com/logo_en.png', $data['logo']['en_US']['url']);
        }
        if (isset($data['favicon']['url'])) {
            $this->assertSame('https://example.com/favicon.ico', $data['favicon']['url']);
        }
        $this->assertSame('zh_CN', $data['default_language']);
    }

    public function testGetGlobalConfigResponseStructure(): void
    {
        $response = $this->get($this->url, [], $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $data = $response['data'];

        // 验证基本结构
        $this->assertIsArray($data);
        $this->assertArrayHasKey('is_maintenance', $data);
        $this->assertArrayHasKey('maintenance_description', $data);

        // 验证类型
        $this->assertIsBool($data['is_maintenance']);
        $this->assertIsString($data['maintenance_description']);

        // 如果有平台设置，验证其结构
        if (isset($data['logo'])) {
            $this->assertIsArray($data['logo']);
        }
        if (isset($data['favicon'])) {
            $this->assertIsArray($data['favicon']);
        }
        if (isset($data['default_language'])) {
            $this->assertIsString($data['default_language']);
        }
    }
}
