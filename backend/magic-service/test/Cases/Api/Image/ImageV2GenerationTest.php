<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Cases\Api\Image;

use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use Exception;
use Hyperf\Contract\StdoutLoggerInterface;
use HyperfTest\Cases\Api\SuperAgent\AbstractApiTest;
use Throwable;

use function Hyperf\Support\retry;

/**
 * @internal
 */
class ImageV2GenerationTest extends AbstractApiTest
{
    private const V1_BASE_URI = '/v1/images';

    private const V2_BASE_URI = '/v2/images';

    public function testV1AndV2()
    {
        $model = 'doubao-seedream-4-0-250828';

        $params = [
            'model' => $model,
            'n' => 1,
            'prompt' => '生成一张白色图片',
            'size' => '2:2',
        ];

        retry(2, function () use ($params) {
            return $this->client->post(
                self::V1_BASE_URI . '/generations',
                $params,
                $this->getCommonHeaders()
            );
        });

        try {
            $response = retry(2, function () use ($params) {
                $response = $this->client->post(
                    self::V2_BASE_URI . '/generations',
                    $params,
                    $this->getCommonHeaders()
                );
                if (count($response['data']) === 0) {
                    throw new Exception($response['provider_error_message']);
                }
                return $response;
            });
        } catch (Throwable $throwable) {
            $response = [
                'data' => [],
                'provider_error_message' => $throwable->getMessage(),
            ];
        }
        $this->assertGreaterThan(0, count($response['data'] ?? []), 'v2/generations 失败 : ' . $response['provider_error_message']);

        $params = [
            'model' => $model,
            'images' => [
                '/MAGIC/713471849556451329/4c9184f37cff01bcdc32dc486ec36961/open/68be511ebc011.png',
            ],
            'prompt' => '加一只小狗',
        ];

        retry(2, function () use ($params) {
            return $this->client->post(
                self::V1_BASE_URI . '/edits',
                $params,
                $this->getCommonHeaders()
            );
        });

        try {
            $response = retry(2, function () use ($params) {
                $response = $this->client->post(
                    self::V2_BASE_URI . '/edits',
                    $params,
                    $this->getCommonHeaders()
                );
                if (count($response['data']) === 0) {
                    throw new Exception($response['provider_error_message']);
                }
                return $response;
            });
        } catch (Throwable $throwable) {
            $response = [
                'data' => [],
                'provider_error_message' => $throwable->getMessage(),
            ];
        }
        $this->assertGreaterThan(1, count($response['data'] ?? []), 'v2/generations 失败 : ' . $response['provider_error_message']);
    }

    public function testV2Generations()
    {
        $logger = di(StdoutLoggerInterface::class);

        $models = [
            'doubao-seedream-4-0-250828', // 豆包
            'gemini-3-pro-image-preview', // google
            'miracleVision_mtlab',
            'Midjourney-turbo',
            'Midjourney-relax',
            'Midjourney-fast',
            'flux1-pro',
            'flux1-dev',
            'high_aes_general_v30l_zt2i',
            'AzureOpenAI-ImageGenerate',
            'qwen-image',
        ];

        $fail = [];
        foreach ($models as $model) {
            $params = [
                'model' => $model,
                'n' => 1,
                'prompt' => '生成一张白色图片',
                'sequential_image_generation' => 'auto',
                'size' => '2:2',
            ];

            try {
                $response = retry(2, function () use ($params) {
                    $response = $this->client->post(
                        self::V2_BASE_URI . '/generations',
                        $params,
                        $this->getCommonHeaders()
                    );
                    if (count($response['data']) === 0) {
                        throw new Exception($response['provider_error_message']);
                    }
                    return $response;
                });
            } catch (Throwable $throwable) {
                $response = [
                    'data' => [],
                    'provider_error_message' => $throwable->getMessage(),
                ];
            }

            if (count($response['data']) >= 1) {
                $logger->info(sprintf('%s:生成图片成功', $model));
            } else {
                $fail[] = $model;
                $logger->error(sprintf('%s:生成图片失败:%s', $model, $response['provider_error_message']));
            }
        }
        $this->assertEquals(0, count($fail), '失败的模型列表：' . implode("\n", $fail));
    }

    public function testV2Edit()
    {
        $logger = di(StdoutLoggerInterface::class);

        $models = [
            'doubao-seedream-4-0-250828', // 豆包
            'qwen-image-edit', // qwen
        ];

        $fail = [];
        foreach ($models as $model) {
            $params = [
                'model' => $model,
                'images' => [
                    '/MAGIC/713471849556451329/4c9184f37cff01bcdc32dc486ec36961/open/68be511ebc011.png',
                ],
                'prompt' => '加一只小狗',
            ];

            try {
                $response = retry(2, function () use ($params) {
                    $response = $this->client->post(
                        self::V2_BASE_URI . '/generations',
                        $params,
                        $this->getCommonHeaders()
                    );
                    if (count($response['data']) === 0) {
                        throw new Exception($response['provider_error_message']);
                    }
                    return $response;
                });
            } catch (Throwable $throwable) {
                $response = [
                    'data' => [],
                    'provider_error_message' => $throwable->getMessage(),
                ];
            }

            if (count($response['data']) >= 1) {
                $logger->info(sprintf('%s:编辑图片成功', $model));
            } else {
                $fail[] = $model;
                $logger->error(sprintf('%s:编辑图片失败:%s', $model, $response['provider_error_message']));
            }
        }
        $this->assertEquals(0, count($fail), '失败的模型列表：' . implode("\n", $fail));
    }

    public function testConnectivityTest()
    {
        $this->switchUserTest1();
        $modelIds = [
            // Google Cloud
            'gemini-2.5-flash-image-preview',
            'gemini-3-pro-image-preview',

            // VolcengineArk
            'doubao-seedream-4-0-250828',

            // 阿里云百炼
            'qwen-image',
            'qwen-image-edit',

            // 火山引擎
            'high_aes_general_v30l_zt2i',
            'high_aes_general_v21_L',
            'byteedit_v2.0',

            // TTAPI.io
            'flux1-dev',
            'flux1-schnell',
            'Midjourney-turbo',
            'Midjourney-fast',

            // 微软 Azure
            'AzureOpenAI-ImageGenerate',
            'AzureOpenAI-ImageEdit',
        ];
        $providerModelDomainService = di(ProviderModelDomainService::class);
        $logger = di(StdoutLoggerInterface::class);
        $dataIsolation = ProviderDataIsolation::create(
            OfficialOrganizationUtil::getOfficialOrganizationCode()
        );

        $failModelIds = [];
        foreach ($modelIds as $modelId) {
            // 根据 model_id 查询模型实体
            $providerModelEntity = $providerModelDomainService->getByModelId($dataIsolation, $modelId);

            if (! $providerModelEntity) {
                continue;
            }

            // 构造请求参数
            $params = [
                'service_provider_config_id' => (string) $providerModelEntity->getServiceProviderConfigId(),
                'model_version' => $providerModelEntity->getModelVersion(),
                'model_id' => (string) $providerModelEntity->getId(),
            ];

            $header = $this->getCommonHeaders();
            unset($header['api-key']);

            // 调用连通性测试接口
            $result = $this->client->post(
                '/api/v1/admin/service-providers/connectivity-test',
                $params,
                $header
            );

            if ($result['data']['status'] ?? false) {
                $logger->info(sprintf('模型 %s 连通性测试正常', $modelId));
            } else {
                $logger->error(sprintf('模型 %s 连通性测试失败: %s', $modelId, $result['ata']['message'] ?? '未知错误'));
                $failModelIds[] = $modelId;
            }
        }
        $this->assertTrue(count($failModelIds) === 0, '连通性测试失败:' . implode("\n", $failModelIds));
    }
}
