<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Kernel;

use App\Application\Kernel\DTO\GlobalConfig;
use App\Application\Kernel\Service\MagicSettingAppService;
use Hyperf\Context\ApplicationContext;
use HyperfTest\Cases\Api\AbstractHttpTest;

/**
 * @internal
 * @coversNothing
 */
class GlobalConfigApiTest extends AbstractHttpTest
{
    private string $url = '/api/v1/settings/global';

    private ?GlobalConfig $originalGlobalConfig = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->originalGlobalConfig = clone $this->getMagicSettingAppService()->getWithoutCache();
    }

    protected function tearDown(): void
    {
        if ($this->originalGlobalConfig !== null) {
            $this->getMagicSettingAppService()->save($this->originalGlobalConfig);
        }

        parent::tearDown();
    }

    public function testGetGlobalConfigDefault(): void
    {
        $this->setBootstrapStatus('');

        $response = $this->get($this->url, [], $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $data = $response['data'];
        $this->assertArrayValueTypesEquals([
            'is_maintenance' => false,
            'maintenance_description' => '',
            'need_initial' => true,
        ], $data, '默认全局配置结构不符', false, true);
        $this->assertArrayHasKey('footer', $data);
        $this->assertSame(
            'Copyright @ 2023 广东灯塔引擎科技有限公司 All Rights Reserved.',
            $data['footer']['copyright_i18n']['zh_CN'] ?? null
        );
    }

    public function testGetGlobalConfigReturnsFreshNeedInitial(): void
    {
        $this->setBootstrapStatus('fresh');

        $response = $this->get($this->url, [], $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);

        $data = $response['data'];
        $this->assertSame('fresh', $data['bootstrap_status']);
        $this->assertTrue($data['need_initial']);
    }

    public function testGetGlobalConfigReturnsInitializedNeedInitialFalse(): void
    {
        $this->setBootstrapStatus('initialized');

        $response = $this->get($this->url, [], $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);

        $data = $response['data'];
        $this->assertSame('initialized', $data['bootstrap_status']);
        $this->assertFalse($data['need_initial']);
    }

    public function testGetAllGlobalConfigReturnsLegacyNeedInitialFalse(): void
    {
        $this->setBootstrapStatus('legacy');

        $response = $this->get('/api/v1/settings/all', [], $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);

        $data = $response['data'];
        $this->assertArrayHasKey('global_config', $data);
        $this->assertSame('legacy', $data['global_config']['bootstrap_status']);
        $this->assertFalse($data['global_config']['need_initial']);
    }

    public function testUpdateGlobalConfig(): void
    {
        $initialResponse = $this->get($this->url, [], $this->getCommonHeaders());
        $this->assertSame(1000, $initialResponse['code']);
        $needInitial = (bool) ($initialResponse['data']['need_initial'] ?? true);

        $payload = [
            'is_maintenance' => true,
            'maintenance_description' => 'unit test maintenance',
        ];

        $putResponse = $this->put($this->url, $payload, $this->getCommonHeaders());
        $this->assertSame(1000, $putResponse['code']);
        $putData = $putResponse['data'];
        $this->assertArrayEquals($payload, $putData, 'PUT 返回数据不一致');
        $this->assertArrayHasKey('need_initial', $putData);
        $this->assertSame($needInitial, (bool) $putData['need_initial']);

        // 再次 GET 验证缓存及持久化
        $getResponse = $this->get($this->url, [], $this->getCommonHeaders());
        $this->assertSame(1000, $getResponse['code']);
        $getData = $getResponse['data'];
        $this->assertArrayEquals($payload, $getData, 'GET 返回数据与预期不符');
        $this->assertArrayHasKey('need_initial', $getData);
        $this->assertSame($needInitial, (bool) $getData['need_initial']);
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
            'footer' => [
                'copyright_i18n' => [
                    'zh_CN' => 'Copyright @ 2026 某某科技有限公司 All Rights Reserved.',
                ],
                'filing' => [
                    'enabled' => true,
                    'number' => '粤ICP备2026000001号',
                ],
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
        $this->assertArrayHasKey('need_initial', $data);
        $this->assertArrayHasKey('bootstrap_status', $data);

        // 验证包含平台设置
        $this->assertArrayHasKey('logo', $data);
        $this->assertArrayHasKey('favicon', $data);
        $this->assertArrayHasKey('default_language', $data);
        $this->assertArrayHasKey('footer', $data);

        // 验证平台设置的值
        $this->assertSame('https://example.com/logo_zh.png', $data['logo']['zh_CN']);
        $this->assertSame('https://example.com/logo_en.png', $data['logo']['en_US']);
        $this->assertSame('https://example.com/favicon.ico', $data['favicon']);
        $this->assertSame('zh_CN', $data['default_language']);
        $this->assertSame(
            'Copyright @ 2026 某某科技有限公司 All Rights Reserved.',
            $data['footer']['copyright_i18n']['zh_CN'] ?? null
        );
        $this->assertTrue($data['footer']['filing']['enabled']);
        $this->assertSame('粤ICP备2026000001号', $data['footer']['filing']['number']);
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
        $this->assertArrayHasKey('bootstrap_status', $data);

        // 验证类型
        $this->assertIsBool($data['is_maintenance']);
        $this->assertIsString($data['maintenance_description']);
        $this->assertIsBool($data['need_initial']);
        $this->assertIsString($data['bootstrap_status']);

        // 如果有平台设置，验证其结构
        if (isset($data['logo'])) {
            $this->assertIsArray($data['logo']);
        }
        if (isset($data['favicon'])) {
            $this->assertTrue(is_string($data['favicon']) || is_null($data['favicon']));
        }
        if (isset($data['default_language'])) {
            $this->assertIsString($data['default_language']);
        }
        if (isset($data['footer'])) {
            $this->assertIsArray($data['footer']);
            $this->assertArrayHasKey('copyright_i18n', $data['footer']);
            $this->assertArrayHasKey('filing', $data['footer']);
        }
    }

    private function getMagicSettingAppService(): MagicSettingAppService
    {
        return ApplicationContext::getContainer()->get(MagicSettingAppService::class);
    }

    private function setBootstrapStatus(string $status): void
    {
        $config = $this->getMagicSettingAppService()->getWithoutCache();
        $config->setBootstrapStatus($status);
        $this->getMagicSettingAppService()->save($config);
    }
}
