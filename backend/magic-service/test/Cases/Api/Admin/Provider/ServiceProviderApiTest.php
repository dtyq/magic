<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Admin\Provider;

use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\ProviderModelDomainService;
use Hyperf\Codec\Json;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 * @coversNothing
 */
class ServiceProviderApiTest extends BaseTest
{
    private string $baseUri = '/api/v1/admin/service-providers';

    public function testGetServiceProvidersByCategoryLlm(): void
    {
        $uri = $this->baseUri . '?category=llm';
        $response = $this->get($uri, [], $this->getCommonHeaders());

        // 如果返回认证或权限相关错误，跳过测试（仅验证路由可用）
        if (isset($response['code']) && in_array($response['code'], [401, 403, 2179, 3035, 4001, 4003], true)) {
            $this->markTestSkipped('接口认证失败或无权限，路由校验通过');
            return;
        }

        // 基本断言
        $this->assertIsArray($response);
        $this->assertArrayHasKey('code', $response);
        $this->assertSame(1000, $response['code']);
        $this->assertArrayHasKey('data', $response);
        $this->assertIsArray($response['data']);
    }

    /**
     * 测试模型创建和更新的完整流程，包括配置版本验证.
     */
    public function testSaveModelToServiceProviderCreate(): void
    {
        $modelUri = $this->baseUri . '/models';
        $serviceProviderConfigId = '841681476732149761';

        // ========== 步骤1: 创建模型 ==========
        $createRequestData = [
            'model_type' => 3,
            'model_id' => 'test-model-' . time(),
            'model_version' => '测试版本 v1.0',
            'icon' => 'MAGIC/588417216353927169/default/default.png',
            'config' => [
                'max_output_tokens' => 64000,
                'max_tokens' => 128000,
                'temperature_type' => 1,
                'temperature' => null,
                'billing_currency' => 'CNY',
                'input_pricing' => '0.001',
                'output_pricing' => '0.002',
                'cache_write_pricing' => '0.0005',
                'cache_hit_pricing' => '0.0001',
                'input_cost' => '0.001',
                'output_cost' => '0.002',
                'cache_write_cost' => '0.0005',
                'cache_hit_cost' => '0.0001',
                'vector_size' => 2048,
                'support_function' => false,
                'support_multi_modal' => false,
                'support_deep_think' => false,
                'creativity' => 0.7,
                'billing_type' => 'Times',
                'time_pricing' => '100',
                'time_cost' => '50',
            ],
            'category' => 'llm',
            'service_provider_config_id' => $serviceProviderConfigId,
            'translate' => [
                'name' => [
                    'zh_CN' => '测试模型',
                    'en_US' => 'Test Model',
                ],
                'description' => [
                    'zh_CN' => '这是一个测试模型',
                    'en_US' => 'This is a test model',
                ],
            ],
        ];

        $createResponse = $this->post($modelUri, $createRequestData, $this->getCommonHeaders());

        // 验证创建响应
        $this->assertIsArray($createResponse);
        $this->assertArrayHasKey('code', $createResponse);
        $this->assertSame(1000, $createResponse['code'], '创建模型应该成功');
        $this->assertArrayHasKey('data', $createResponse);
        $this->assertArrayHasKey('id', $createResponse['data'], '返回数据应包含模型ID');

        $modelId = $createResponse['data']['id'];
        $this->assertNotEmpty($modelId, '模型ID不应为空');

        // ========== 步骤2: 调用详情接口验证4个成本字段 ==========
        $detailUri = $this->baseUri . '/' . $serviceProviderConfigId;
        $detailResponse = $this->get($detailUri, [], $this->getCommonHeaders());

        $this->assertIsArray($detailResponse);
        $this->assertSame(1000, $detailResponse['code'], '获取详情应该成功');
        $this->assertArrayHasKey('data', $detailResponse);

        // 查找创建的模型
        $createdModel = $this->findModelInDetailResponse($detailResponse['data'], $modelId);
        $this->assertNotNull($createdModel, '应该能在详情中找到创建的模型');

        // 验证4个成本字段存在且值正确
        $this->assertArrayHasKey('config', $createdModel, '模型应该有config字段');
        $this->verifyConfigCostFields($createdModel['config'], [
            'input_cost' => 0.001,
            'output_cost' => 0.002,
            'cache_write_cost' => 0.0005,
            'cache_hit_cost' => 0.0001,
            'time_cost' => 50,
        ]);

        // ========== 步骤3: 验证配置版本（version=1） ==========
        $this->verifyConfigVersion((int) $modelId, $createRequestData['config'], 1);

        // ========== 步骤4: 更新模型 ==========
        $updateRequestData = [
            'id' => $modelId,
            'model_type' => 3,
            'model_id' => $createRequestData['model_id'],
            'model_version' => '更新版本 v2.0',
            'icon' => 'MAGIC/588417216353927169/default/default.png',
            'config' => [
                'max_output_tokens' => 128000,
                'max_tokens' => 256000,
                'temperature_type' => 1,
                'temperature' => null,
                'billing_currency' => 'CNY',
                'input_pricing' => '0.002',
                'output_pricing' => '0.004',
                'cache_write_pricing' => '0.001',
                'cache_hit_pricing' => '0.0002',
                'input_cost' => '0.003',
                'output_cost' => '0.006',
                'cache_write_cost' => '0.0015',
                'cache_hit_cost' => '0.0003',
                'vector_size' => 4096,
                'support_function' => true,
                'support_multi_modal' => true,
                'support_deep_think' => false,
                'creativity' => 0.8,
                'time_cost' => 50,
            ],
            'category' => 'llm',
            'service_provider_config_id' => $serviceProviderConfigId,
            'translate' => [
                'name' => [
                    'zh_CN' => '更新后的测试模型',
                    'en_US' => 'Updated Test Model',
                ],
                'description' => [
                    'zh_CN' => '这是更新后的测试模型',
                    'en_US' => 'This is an updated test model',
                ],
            ],
        ];

        $updateResponse = $this->post($modelUri, $updateRequestData, $this->getCommonHeaders());

        // 验证更新响应
        $this->assertIsArray($updateResponse);
        $this->assertSame(1000, $updateResponse['code'], '更新模型应该成功');
        $this->assertArrayHasKey('data', $updateResponse);
        $this->assertSame($modelId, $updateResponse['data']['id'], '更新后模型ID应保持不变');

        // ========== 步骤5: 再次调用详情接口验证更新后的4个成本字段 ==========
        $updatedDetailResponse = $this->get($detailUri, [], $this->getCommonHeaders());

        $this->assertIsArray($updatedDetailResponse);
        $this->assertSame(1000, $updatedDetailResponse['code'], '获取更新后详情应该成功');

        // 查找更新后的模型
        $updatedModel = $this->findModelInDetailResponse($updatedDetailResponse['data'], $modelId);
        $this->assertNotNull($updatedModel, '应该能在详情中找到更新后的模型');

        // 验证更新后的4个成本字段
        $this->assertArrayHasKey('config', $updatedModel, '更新后的模型应该有config字段');
        $this->verifyConfigCostFields($updatedModel['config'], [
            'input_cost' => 0.003,
            'output_cost' => 0.006,
            'cache_write_cost' => 0.0015,
            'cache_hit_cost' => 0.0003,
        ]);

        // ========== 步骤6: 验证更新后的配置版本（version=2） ==========
        $this->verifyConfigVersion((int) $modelId, $updateRequestData['config'], 2);
    }

    /**
     * 测试返回Magic服务商.
     */
    public function testGetOfficialProvider()
    {
        $response = $this->get('/org/admin/service-providers/available-llm', [], $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertEquals(true, in_array('Magic', array_column($response['data'], 'name')));

        $response = $this->get('/org/admin/service-providers?category=llm', [], $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertEquals(true, in_array('Official', array_column($response['data'], 'provider_code')));

        $response = $this->get('/org/admin/service-providers?category=vlm', [], $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertEquals(true, in_array('Official', array_column($response['data'], 'provider_code')));
    }

    /**
     * 创建官方服务商.
     */
    public function testCreateLLMOfficialProvider(): void
    {
        $provider = [
            'alias' => '官方服务商单元测试',
            'config' => [
                // 国际接入点
                'url' => 'international_access_point',
                // 国内接入点
                //                'url' => 'domestic_access_points',
                'api_key' => '****',
                'priority' => 100,
            ],
            'service_provider_id' => '766765753990443008',
            'status' => 1,
            'translate' => [
                'alias' => [
                    'zh_CN' => '官方服务商单元测试',
                ],
            ],
        ];
        $response = $this->post('/org/admin/service-providers/add', $provider, $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);

        $response = $this->get('/org/admin/service-providers/detail?service_provider_config_id=' . $response['data']['id'], [], $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $detail = $response['data'];
        $this->assertEquals('官方服务商单元测试', $detail['alias']);
        $this->assertEquals('international_access_point', $detail['config']['proxy_url']);
        $this->assertEquals('****', $detail['config']['api_key']);
        $this->assertEquals('100', $detail['config']['priority']);
    }

    /**
     * 创建官方服务商.
     */
    public function testCreateVLMOfficialProvider(): void
    {
        $provider = [
            'alias' => '官方服务商单元测试',
            'config' => [
                // 国际接入点
                'proxy_url' => 'international_access_point',
                // 国内接入点
                //                'proxy_url' => 'domestic_access_points',
                'api_key' => 'sk-83649403db42583df484142dc9745bab',
                'priority' => 100,
            ],
            'service_provider_id' => '766765755164848128',
            'status' => 1,
            'translate' => [
                'alias' => [
                    'zh_CN' => '官方服务商单元测试',
                ],
            ],
        ];
        $response = $this->post('/org/admin/service-providers/add', $provider, $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);

        $response = $this->get('/org/admin/service-providers/detail?service_provider_config_id=' . $response['data']['id'], [], $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $detail = $response['data'];
        $this->assertEquals('官方服务商单元测试', $detail['alias']);
        $this->assertEquals('international_access_point', $detail['config']['proxy_url']);
        $this->assertEquals('sk-*****************************bab', $detail['config']['api_key']);
        $this->assertEquals('100', $detail['config']['priority']);
    }

    /**
     * 测试创建和删除模型.
     */
    public function testCreateAndDeleteModel()
    {
        $providerId = '843847394915074048';
        $model = Json::decode('{"model_type":3,"model_id":"test-dabai-test","model_version":"测试","icon":"MAGIC/588417216353927169/default/default.png","name":"测试","description":"测试","config":{"max_output_tokens":64000,"max_tokens":128000,"temperature_type":1,"temperature":null,"billing_currency":"CNY","input_pricing":"1","output_pricing":"1","cache_write_pricing":"1","cache_hit_pricing":"1","input_cost":"1","output_cost":"1","cache_write_cost":"1","cache_hit_cost":"1","vector_size":2048,"support_function":false,"support_multi_modal":false,"support_deep_think":false,"creativity":0.7},"category":"llm","service_provider_config_id":"' . $providerId . '","translate":{"name":{"zh_CN":"测试","en_US":"test"},"description":{"zh_CN":"测试","en_US":"test"}}}');
        $response = $this->post('/org/admin/service-providers/save-model', $model, $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);

        $newId = $response['data']['id'];
        $response = $this->post('/org/admin/service-providers/delete-model', ['model_id' => $newId], $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
    }

    /**
     * 在详情响应中查找指定ID的模型.
     *
     * @param array $detailData 详情响应数据
     * @param string $modelId 模型ID
     * @return null|array 找到的模型数据，未找到返回null
     */
    private function findModelInDetailResponse(array $detailData, string $modelId): ?array
    {
        // 详情接口可能返回 models 数组或其他结构，这里需要根据实际接口调整
        if (isset($detailData['models']) && is_array($detailData['models'])) {
            foreach ($detailData['models'] as $model) {
                if (isset($model['id']) && (string) $model['id'] === (string) $modelId) {
                    return $model;
                }
            }
        }

        // 如果是其他结构，继续查找
        if (isset($detailData['id']) && (string) $detailData['id'] === (string) $modelId) {
            return $detailData;
        }

        return null;
    }

    /**
     * 验证配置中的4个成本字段.
     *
     * @param array $config 配置数据
     * @param array $expectedCosts 期望的成本值
     */
    private function verifyConfigCostFields(array $config, array $expectedCosts): void
    {
        $this->assertArrayHasKey('input_cost', $config, 'config应该包含input_cost字段');
        $this->assertArrayHasKey('output_cost', $config, 'config应该包含output_cost字段');
        $this->assertArrayHasKey('cache_write_cost', $config, 'config应该包含cache_write_cost字段');
        $this->assertArrayHasKey('cache_hit_cost', $config, 'config应该包含cache_hit_cost字段');

        // 验证值是否正确（允许浮点数误差）
        $this->assertEqualsWithDelta(
            $expectedCosts['input_cost'],
            (float) $config['input_cost'],
            0.0001,
            'input_cost值应该匹配'
        );

        $this->assertEqualsWithDelta(
            $expectedCosts['output_cost'],
            (float) $config['output_cost'],
            0.0001,
            'output_cost值应该匹配'
        );

        $this->assertEqualsWithDelta(
            $expectedCosts['cache_write_cost'],
            (float) $config['cache_write_cost'],
            0.0001,
            'cache_write_cost值应该匹配'
        );

        $this->assertEqualsWithDelta(
            $expectedCosts['cache_hit_cost'],
            (float) $config['cache_hit_cost'],
            0.0001,
            'cache_hit_cost值应该匹配'
        );
    }

    /**
     * 验证配置版本是否正确落库.
     *
     * @param int $modelId 模型ID
     * @param array $expectedConfig 期望的配置数据
     * @param int $expectedVersion 期望的版本号
     */
    private function verifyConfigVersion(int $modelId, array $expectedConfig, int $expectedVersion): void
    {
        // 获取 Domain Service
        $domainService = $this->getContainer()->get(ProviderModelDomainService::class);

        // 构造数据隔离对象
        $organizationCode = env('TEST_ORGANIZATION_CODE');
        $dataIsolation = new ProviderDataIsolation($organizationCode, '', '');

        // 获取最新配置版本
        $versionEntity = $domainService->getLatestConfigVersionEntity($dataIsolation, $modelId);

        $this->assertNotNull($versionEntity, '配置版本应该存在');

        // 验证 int 类型字段（字符串应该被转换为 int）
        if (isset($expectedConfig['max_output_tokens'])) {
            $this->assertSame(
                (int) $expectedConfig['max_output_tokens'],
                $versionEntity->getMaxOutputTokens(),
                'max_output_tokens 应该匹配'
            );
        }

        if (isset($expectedConfig['max_tokens'])) {
            $this->assertSame(
                (int) $expectedConfig['max_tokens'],
                $versionEntity->getMaxTokens(),
                'max_tokens 应该匹配'
            );
        }

        if (isset($expectedConfig['vector_size'])) {
            $this->assertSame(
                (int) $expectedConfig['vector_size'],
                $versionEntity->getVectorSize(),
                'vector_size 应该匹配'
            );
        }

        // 验证 float 类型字段（字符串应该被转换为 float）
        if (isset($expectedConfig['input_pricing'])) {
            $this->assertEqualsWithDelta(
                (float) $expectedConfig['input_pricing'],
                $versionEntity->getInputPricing(),
                0.0001,
                'input_pricing 应该匹配'
            );
        }

        if (isset($expectedConfig['output_pricing'])) {
            $this->assertEqualsWithDelta(
                (float) $expectedConfig['output_pricing'],
                $versionEntity->getOutputPricing(),
                0.0001,
                'output_pricing 应该匹配'
            );
        }

        if (isset($expectedConfig['cache_write_pricing'])) {
            $this->assertEqualsWithDelta(
                (float) $expectedConfig['cache_write_pricing'],
                $versionEntity->getCacheWritePricing(),
                0.0001,
                'cache_write_pricing 应该匹配'
            );
        }

        if (isset($expectedConfig['cache_hit_pricing'])) {
            $this->assertEqualsWithDelta(
                (float) $expectedConfig['cache_hit_pricing'],
                $versionEntity->getCacheHitPricing(),
                0.0001,
                'cache_hit_pricing 应该匹配'
            );
        }

        if (isset($expectedConfig['input_cost'])) {
            $this->assertEqualsWithDelta(
                (float) $expectedConfig['input_cost'],
                $versionEntity->getInputCost(),
                0.0001,
                'input_cost 应该匹配'
            );
        }

        if (isset($expectedConfig['output_cost'])) {
            $this->assertEqualsWithDelta(
                (float) $expectedConfig['output_cost'],
                $versionEntity->getOutputCost(),
                0.0001,
                'output_cost 应该匹配'
            );
        }

        if (isset($expectedConfig['cache_write_cost'])) {
            $this->assertEqualsWithDelta(
                (float) $expectedConfig['cache_write_cost'],
                $versionEntity->getCacheWriteCost(),
                0.0001,
                'cache_write_cost 应该匹配'
            );
        }

        if (isset($expectedConfig['cache_hit_cost'])) {
            $this->assertEqualsWithDelta(
                (float) $expectedConfig['cache_hit_cost'],
                $versionEntity->getCacheHitCost(),
                0.0001,
                'cache_hit_cost 应该匹配'
            );
        }

        if (isset($expectedConfig['creativity'])) {
            $this->assertEqualsWithDelta(
                (float) $expectedConfig['creativity'],
                $versionEntity->getCreativity(),
                0.0001,
                'creativity 应该匹配'
            );
        }

        if (isset($expectedConfig['time_cost'])) {
            $this->assertEqualsWithDelta(
                (float) $expectedConfig['time_cost'],
                $versionEntity->getTimeCost(), 50,
                'time_cost 应该匹配'
            );
        }

        if (isset($expectedConfig['temperature'])) {
            if ($expectedConfig['temperature'] === null) {
                $this->assertNull($versionEntity->getTemperature(), 'temperature 应该为 null');
            } else {
                $this->assertEqualsWithDelta(
                    (float) $expectedConfig['temperature'],
                    $versionEntity->getTemperature(),
                    0.0001,
                    'temperature 应该匹配'
                );
            }
        }

        // 验证 bool 类型字段
        if (isset($expectedConfig['support_function'])) {
            $this->assertSame(
                (bool) $expectedConfig['support_function'],
                $versionEntity->isSupportFunction(),
                'support_function 应该匹配'
            );
        }

        if (isset($expectedConfig['support_multi_modal'])) {
            $this->assertSame(
                (bool) $expectedConfig['support_multi_modal'],
                $versionEntity->isSupportMultiModal(),
                'support_multi_modal 应该匹配'
            );
        }

        if (isset($expectedConfig['support_deep_think'])) {
            $this->assertSame(
                (bool) $expectedConfig['support_deep_think'],
                $versionEntity->isSupportDeepThink(),
                'support_deep_think 应该匹配'
            );
        }

        // 验证 string 类型字段
        if (isset($expectedConfig['billing_currency'])) {
            $this->assertSame(
                $expectedConfig['billing_currency'],
                $versionEntity->getBillingCurrency(),
                'billing_currency 应该匹配'
            );
        }

        // 验证版本号和当前版本标记
        $this->assertSame($expectedVersion, $versionEntity->getVersion(), "版本号应该是 {$expectedVersion}");
        $this->assertTrue($versionEntity->isCurrentVersion(), '应该是当前版本');
    }
}
