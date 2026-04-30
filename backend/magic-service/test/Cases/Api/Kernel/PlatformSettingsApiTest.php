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
        $this->assertArrayHasKey('footer', $data);
        $this->assertIsArray($data['logo']);
        $this->assertIsArray($data['footer']);
        $this->assertSame(
            'Copyright @ 2023 广东灯塔引擎科技有限公司 All Rights Reserved.',
            $data['footer']['copyright_i18n']['zh_CN'] ?? null
        );
        // favicon 可以是字符串或 null
        $this->assertTrue(is_string($data['favicon']) || is_null($data['favicon']));
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
            'footer' => [
                'copyright_i18n' => [
                    'zh_CN' => 'Copyright @ 2026 某某科技有限公司 All Rights Reserved.',
                    'en_US' => 'Copyright @ 2026 Example Corp. All Rights Reserved.',
                ],
                'filing' => [
                    'enabled' => true,
                    'number' => '粤ICP备2026000001号',
                    'link' => 'https://beian.miit.gov.cn/',
                ],
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
        $this->assertSame('https://example.com/logo_zh.png', $data['logo']['zh_CN']);
        $this->assertSame('https://example.com/logo_en.png', $data['logo']['en_US']);

        // 验证 favicon
        $this->assertSame('https://example.com/favicon.ico', $data['favicon']);

        // 验证其他字段
        $this->assertSame('en_US', $data['default_language']);
        $this->assertArrayEquals($payload['name_i18n'], $data['name_i18n'], 'name_i18n 不匹配');
        $this->assertArrayEquals($payload['title_i18n'], $data['title_i18n'], 'title_i18n 不匹配');
        $this->assertArrayEquals($payload['keywords_i18n'], $data['keywords_i18n'], 'keywords_i18n 不匹配');
        $this->assertArrayEquals($payload['description_i18n'], $data['description_i18n'], 'description_i18n 不匹配');
        $this->assertArrayEquals($payload['footer'], $data['footer'], 'footer 不匹配');

        // 再次 GET 验证持久化
        $getResponse = $this->get($this->getUrl, [], $this->getCommonHeaders());
        $this->assertSame(1000, $getResponse['code']);
        $getData = $getResponse['data'];
        $this->assertSame('https://example.com/logo_zh.png', $getData['logo']['zh_CN']);
        $this->assertSame('https://example.com/logo_en.png', $getData['logo']['en_US']);
        $this->assertSame('https://example.com/favicon.ico', $getData['favicon']);
        $this->assertSame('en_US', $getData['default_language']);
        $this->assertArrayEquals($payload['footer'], $getData['footer'], 'footer 持久化失败');
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
        $this->assertSame('https://example.com/updated_logo_zh.png', $data['logo']['zh_CN']);
        // 验证英文 logo 保持不变
        $this->assertSame('https://example.com/initial_logo_en.png', $data['logo']['en_US']);
        // 验证 favicon 保持不变
        $this->assertSame('https://example.com/initial_favicon.ico', $data['favicon']);
    }

    public function testUpdatePlatformSettingsWithFooterOnly(): void
    {
        $payload = [
            'footer' => [
                'copyright_i18n' => [
                    'zh_CN' => 'Copyright @ 2026 私有化客户 All Rights Reserved.',
                ],
                'filing' => [
                    'enabled' => true,
                    'number' => '沪ICP备2026000001号',
                ],
            ],
        ];

        $response = $this->put($this->putUrl, $payload, $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $data = $response['data'];

        $this->assertArrayHasKey('footer', $data);
        $this->assertSame($payload['footer']['copyright_i18n']['zh_CN'], $data['footer']['copyright_i18n']['zh_CN']);
        $this->assertTrue($data['footer']['filing']['enabled']);
        $this->assertSame($payload['footer']['filing']['number'], $data['footer']['filing']['number']);
        $this->assertSame('https://beian.miit.gov.cn/', $data['footer']['filing']['link']);
    }

    public function testUpdatePlatformSettingsCanClearFooterFiling(): void
    {
        $initialPayload = [
            'footer' => [
                'filing' => [
                    'enabled' => true,
                    'number' => '粤ICP备2026000002号',
                    'link' => 'https://beian.miit.gov.cn/',
                ],
            ],
        ];
        $this->put($this->putUrl, $initialPayload, $this->getCommonHeaders());

        $payload = [
            'footer' => [
                'filing' => [
                    'enabled' => false,
                    'number' => '',
                    'link' => '',
                ],
            ],
        ];

        $response = $this->put($this->putUrl, $payload, $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $data = $response['data'];

        $this->assertFalse($data['footer']['filing']['enabled']);
        $this->assertSame('', $data['footer']['filing']['number']);
        $this->assertSame('https://beian.miit.gov.cn/', $data['footer']['filing']['link']);
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

    public function testUpdatePlatformSettingsRejectsFooterFilingWithoutNumberWhenEnabled(): void
    {
        $payload = [
            'footer' => [
                'filing' => [
                    'enabled' => true,
                    'number' => '',
                ],
            ],
        ];

        $response = $this->put($this->putUrl, $payload, $this->getCommonHeaders());
        $this->assertNotSame(1000, $response['code']);
    }

    public function testUpdatePlatformSettingsWithInvalidUrl(): void
    {
        // 测试无效的 URL（没有协议）
        $payload = [
            'favicon_url' => 'example.com/favicon.ico', // 缺少协议
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
        $this->assertSame('https://example.com/favicon.ico', $data['favicon']);
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
        $this->assertSame('https://example.com/logo_zh_new.png', $data['logo']['zh_CN']);
        $this->assertSame('https://example.com/logo_en_new.png', $data['logo']['en_US']);
    }

    public function testUpdatePlatformSettingsWithAgentRoleFields(): void
    {
        $payload = [
            'favicon_url' => 'https://example.com/favicon.ico',
            'agent_role_name_i18n' => [
                'zh_CN' => '智能助手',
                'en_US' => 'Smart Assistant',
            ],
            'agent_role_description_i18n' => [
                'zh_CN' => '这是一个智能助手的角色描述',
                'en_US' => 'This is a smart assistant role description',
            ],
        ];

        $response = $this->put($this->putUrl, $payload, $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $data = $response['data'];

        // 验证新字段存在并且值正确
        $this->assertArrayHasKey('agent_role_name_i18n', $data);
        $this->assertArrayHasKey('agent_role_description_i18n', $data);
        $this->assertArrayEquals($payload['agent_role_name_i18n'], $data['agent_role_name_i18n'], 'agent_role_name_i18n 不匹配');
        $this->assertArrayEquals($payload['agent_role_description_i18n'], $data['agent_role_description_i18n'], 'agent_role_description_i18n 不匹配');

        // 再次 GET 验证持久化
        $getResponse = $this->get($this->getUrl, [], $this->getCommonHeaders());
        $this->assertSame(1000, $getResponse['code']);
        $getData = $getResponse['data'];
        $this->assertArrayHasKey('agent_role_name_i18n', $getData);
        $this->assertArrayHasKey('agent_role_description_i18n', $getData);
        $this->assertArrayEquals($payload['agent_role_name_i18n'], $getData['agent_role_name_i18n'], 'agent_role_name_i18n 持久化失败');
        $this->assertArrayEquals($payload['agent_role_description_i18n'], $getData['agent_role_description_i18n'], 'agent_role_description_i18n 持久化失败');
    }

    public function testUpdatePlatformSettingsWithPartialAgentRoleFields(): void
    {
        // 首先设置完整数据
        $initialPayload = [
            'favicon_url' => 'https://example.com/favicon.ico',
            'agent_role_name_i18n' => [
                'zh_CN' => '初始助手名称',
                'en_US' => 'Initial Assistant Name',
            ],
            'agent_role_description_i18n' => [
                'zh_CN' => '初始助手描述',
                'en_US' => 'Initial Assistant Description',
            ],
        ];
        $this->put($this->putUrl, $initialPayload, $this->getCommonHeaders());

        // 部分更新：仅更新角色名称
        $partialPayload = [
            'agent_role_name_i18n' => [
                'zh_CN' => '更新后的助手名称',
                'en_US' => 'Updated Assistant Name',
            ],
        ];
        $response = $this->put($this->putUrl, $partialPayload, $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $data = $response['data'];

        // 验证角色名称已更新
        $this->assertArrayEquals($partialPayload['agent_role_name_i18n'], $data['agent_role_name_i18n'], 'agent_role_name_i18n 未更新');
        // 验证角色描述保持不变
        $this->assertArrayEquals($initialPayload['agent_role_description_i18n'], $data['agent_role_description_i18n'], 'agent_role_description_i18n 不应该改变');
    }
}
