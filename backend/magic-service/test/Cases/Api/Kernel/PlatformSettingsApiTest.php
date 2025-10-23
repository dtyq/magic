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
class PlatformSettingsApiTest extends AbstractHttpTest
{
    private string $getUrl = '/api/v1/platform/setting';

    private string $putUrl = '/api/v1/platform/setting';

    public function testShowDefaultPlatformSettings(): void
    {
        $response = $this->get($this->getUrl, [], $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $data = $response['data'];

        // 验证响应结构
        $this->assertArrayHasKey('logo', $data);
        $this->assertArrayHasKey('favicon', $data);
        $this->assertArrayHasKey('default_language', $data);
        $this->assertIsArray($data['logo']);
        $this->assertIsArray($data['favicon']);
        $this->assertIsString($data['default_language']);
    }

    public function testUpdatePlatformSettingsWithAllFields(): void
    {
        $payload = [
            'logo_zh_url' => 'https://example.com/logo_zh.png',
            'logo_en_url' => 'https://example.com/logo_en.png',
            'favicon_url' => 'https://example.com/favicon.ico',
            'default_language' => 'en_US',
            'name_i18n' => [
                'zh_CN' => '测试平台',
                'en_US' => 'Test Platform',
            ],
            'title_i18n' => [
                'zh_CN' => '测试平台标题',
                'en_US' => 'Test Platform Title',
            ],
            'keywords_i18n' => [
                'zh_CN' => 'AI,测试',
                'en_US' => 'AI,Test',
            ],
            'description_i18n' => [
                'zh_CN' => '这是一个测试平台',
                'en_US' => 'This is a test platform',
            ],
        ];

        $response = $this->put($this->putUrl, $payload, $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $data = $response['data'];

        // 验证响应结构
        $this->assertArrayHasKey('logo', $data);
        $this->assertArrayHasKey('favicon', $data);
        $this->assertArrayHasKey('default_language', $data);

        // 验证 logo
        $this->assertArrayHasKey('zh_CN', $data['logo']);
        $this->assertArrayHasKey('en_US', $data['logo']);
        $this->assertSame('https://example.com/logo_zh.png', $data['logo']['zh_CN']['url']);
        $this->assertSame('https://example.com/logo_en.png', $data['logo']['en_US']['url']);

        // 验证 favicon
        $this->assertSame('https://example.com/favicon.ico', $data['favicon']['url']);

        // 验证其他字段
        $this->assertSame('en_US', $data['default_language']);
        $this->assertArrayEquals($payload['name_i18n'], $data['name_i18n'], 'name_i18n 不匹配');
        $this->assertArrayEquals($payload['title_i18n'], $data['title_i18n'], 'title_i18n 不匹配');
        $this->assertArrayEquals($payload['keywords_i18n'], $data['keywords_i18n'], 'keywords_i18n 不匹配');
        $this->assertArrayEquals($payload['description_i18n'], $data['description_i18n'], 'description_i18n 不匹配');

        // 再次 GET 验证持久化
        $getResponse = $this->get($this->getUrl, [], $this->getCommonHeaders());
        $this->assertSame(1000, $getResponse['code']);
        $getData = $getResponse['data'];
        $this->assertSame('https://example.com/logo_zh.png', $getData['logo']['zh_CN']['url']);
        $this->assertSame('https://example.com/logo_en.png', $getData['logo']['en_US']['url']);
        $this->assertSame('https://example.com/favicon.ico', $getData['favicon']['url']);
        $this->assertSame('en_US', $getData['default_language']);
    }

    public function testUpdatePlatformSettingsPartially(): void
    {
        // 首先设置完整数据
        $initialPayload = [
            'logo_zh_url' => 'https://example.com/initial_logo_zh.png',
            'logo_en_url' => 'https://example.com/initial_logo_en.png',
            'favicon_url' => 'https://example.com/initial_favicon.ico',
            'default_language' => 'zh_CN',
            'name_i18n' => [
                'zh_CN' => '初始平台',
                'en_US' => 'Initial Platform',
            ],
        ];
        $this->put($this->putUrl, $initialPayload, $this->getCommonHeaders());

        // 部分更新：仅更新中文 logo
        $partialPayload = [
            'logo_zh_url' => 'https://example.com/updated_logo_zh.png',
        ];
        $response = $this->put($this->putUrl, $partialPayload, $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $data = $response['data'];

        // 验证中文 logo 已更新
        $this->assertSame('https://example.com/updated_logo_zh.png', $data['logo']['zh_CN']['url']);
        // 验证英文 logo 保持不变
        $this->assertSame('https://example.com/initial_logo_en.png', $data['logo']['en_US']['url']);
        // 验证 favicon 保持不变
        $this->assertSame('https://example.com/initial_favicon.ico', $data['favicon']['url']);
    }

    public function testUpdatePlatformSettingsWithInvalidLanguage(): void
    {
        $payload = [
            'favicon_url' => 'https://example.com/favicon.ico',
            'default_language' => 'invalid_locale', // 无效的语言
        ];

        $response = $this->put($this->putUrl, $payload, $this->getCommonHeaders());
        // 应该返回验证失败错误
        $this->assertNotSame(1000, $response['code']);
    }

    public function testUpdatePlatformSettingsWithInvalidUrl(): void
    {
        // 测试非 https URL
        $payload = [
            'favicon_url' => 'http://example.com/favicon.ico', // 非 https
        ];

        $response = $this->put($this->putUrl, $payload, $this->getCommonHeaders());
        // 应该返回验证失败错误
        $this->assertNotSame(1000, $response['code']);
    }

    public function testUpdatePlatformSettingsWithEmptyFavicon(): void
    {
        // 首先设置 favicon
        $initialPayload = [
            'favicon_url' => 'https://example.com/favicon.ico',
        ];
        $this->put($this->putUrl, $initialPayload, $this->getCommonHeaders());

        // 尝试清空 favicon (传入空字符串不会更新，所以不应该失败)
        $payload = [
            'favicon_url' => '', // 空字符串
            'default_language' => 'zh_CN',
        ];

        $response = $this->put($this->putUrl, $payload, $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        // favicon 应该保持原值（因为空字符串不会更新）
        $data = $response['data'];
        $this->assertSame('https://example.com/favicon.ico', $data['favicon']['url']);
    }

    public function testUpdatePlatformSettingsWithI18nFields(): void
    {
        $payload = [
            'favicon_url' => 'https://example.com/favicon.ico',
            'name_i18n' => [
                'zh_CN' => '我的平台',
                'en_US' => 'My Platform',
            ],
            'title_i18n' => [
                'zh_CN' => '网站标题',
                'en_US' => 'Website Title',
            ],
        ];

        $response = $this->put($this->putUrl, $payload, $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $data = $response['data'];

        $this->assertArrayHasKey('name_i18n', $data);
        $this->assertArrayHasKey('title_i18n', $data);
        $this->assertArrayEquals($payload['name_i18n'], $data['name_i18n'], 'name_i18n 不匹配');
        $this->assertArrayEquals($payload['title_i18n'], $data['title_i18n'], 'title_i18n 不匹配');
    }

    public function testUpdatePlatformSettingsWithLogoUrls(): void
    {
        $payload = [
            'favicon_url' => 'https://example.com/favicon.ico',
            'logo_zh_url' => 'https://example.com/logo_zh_new.png',
            'logo_en_url' => 'https://example.com/logo_en_new.png',
        ];

        $response = $this->put($this->putUrl, $payload, $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $data = $response['data'];

        $this->assertArrayHasKey('logo', $data);
        $this->assertArrayHasKey('zh_CN', $data['logo']);
        $this->assertArrayHasKey('en_US', $data['logo']);
        $this->assertSame('https://example.com/logo_zh_new.png', $data['logo']['zh_CN']['url']);
        $this->assertSame('https://example.com/logo_en_new.png', $data['logo']['en_US']['url']);
    }
}
