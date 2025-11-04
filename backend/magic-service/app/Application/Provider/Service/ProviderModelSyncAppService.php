<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Service;

use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Provider\DTO\SaveProviderModelDTO;
use Hyperf\Guzzle\ClientFactory;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Support\retry;

/**
 * 服务商模型同步应用服务.
 * 负责从外部API拉取模型并同步到Official服务商.
 */
class ProviderModelSyncAppService
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly ProviderConfigDomainService $providerConfigDomainService,
        private readonly ProviderModelDomainService $providerModelDomainService,
        private readonly ClientFactory $clientFactory,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('ProviderModelSync');
    }

    /**
     * 从外部API同步模型.
     * 当服务商配置创建或更新时，如果是Official服务商且是官方组织，则从外部API拉取模型.
     */
    public function syncModelsFromExternalApi(
        ProviderConfigEntity $providerConfigEntity,
        string $organizationCode
    ): void {
        // 1. 检查是否为Official服务商
        $dataIsolation = ProviderDataIsolation::create($organizationCode);
        $provider = $this->providerConfigDomainService->getProviderById($dataIsolation, $providerConfigEntity->getServiceProviderId());

        if (! $provider || $provider->getProviderCode() !== ProviderCode::Official) {
            $this->logger->debug('不是Official服务商，跳过同步', [
                'config_id' => $providerConfigEntity->getId(),
                'provider_code' => $provider?->getProviderCode()->value,
            ]);
            return;
        }

        $this->logger->info('开始从外部API同步模型', [
            'config_id' => $providerConfigEntity->getId(),
            'organization_code' => $organizationCode,
            'provider_code' => $provider->getProviderCode()->value,
        ]);

        try {
            // 3. 解析配置
            $config = $providerConfigEntity->getConfig();
            if (! $config) {
                $this->logger->warning('配置为空，跳过同步', [
                    'config_id' => $providerConfigEntity->getId(),
                ]);
                return;
            }

            $proxyUrl = $config->getProxyUrl(); // proxy_url 存在 url 字段中
            $apiKey = $config->getApiKey();
            if (! $proxyUrl || ! $apiKey) {
                $this->logger->warning('配置不完整，缺少proxy_url或api_key', [
                    'config_id' => $providerConfigEntity->getId(),
                    'has_proxy_url' => ! empty($proxyUrl),
                    'has_api_key' => ! empty($apiKey),
                ]);
                return;
            }

            // 4. 根据category确定type参数
            $types = $this->getModelTypesByCategory($provider->getCategory());

            // 5. 从外部API拉取模型
            $models = $this->fetchModelsFromApi($proxyUrl, $apiKey, $types);

            if (empty($models)) {
                $this->logger->warning('未从外部API获取到模型', [
                    'config_id' => $providerConfigEntity->getId(),
                    'proxy_url' => $proxyUrl,
                ]);
                return;
            }

            // 6. 同步模型到数据库
            $this->syncModelsToDatabase($dataIsolation, $providerConfigEntity, $models);

            $this->logger->info('从外部API同步模型完成', [
                'config_id' => $providerConfigEntity->getId(),
                'model_count' => count($models),
            ]);
        } catch (Throwable $e) {
            $this->logger->error('从外部API同步模型失败', [
                'config_id' => $providerConfigEntity->getId(),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
            throw $e;
        }
    }

    /**
     * 根据服务商category确定要拉取的模型type.
     */
    private function getModelTypesByCategory(Category $category): array
    {
        return match ($category) {
            Category::LLM => ['chat', 'embedding'],
            Category::VLM => ['image'],
            default => [],
        };
    }

    /**
     * 从外部API拉取模型.
     */
    private function fetchModelsFromApi(string $proxyUrl, string $apiKey, array $types): array
    {
        // 获取API地址
        $apiUrl = $this->getUrlByProxyUrl($proxyUrl) ?? null;
        if (! $apiUrl) {
            $this->logger->error('不支持的proxy_url', [
                'proxy_url' => $proxyUrl,
            ]);
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, '不支持的proxy_url: ' . $proxyUrl);
        }

        $allModels = [];

        // 为每个type调用API
        foreach ($types as $type) {
            try {
                $models = retry(3, function () use ($apiUrl, $apiKey, $type) {
                    return $this->callModelsApi($apiUrl, $apiKey, $type);
                }, 500);
                $allModels = array_merge($allModels, $models);
            } catch (Throwable $e) {
                $this->logger->error("拉取{$type}类型模型失败", [
                    'type' => $type,
                    'api_url' => $apiUrl,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $allModels;
    }

    /**
     * 调用外部API获取模型列表.
     */
    private function callModelsApi(string $apiUrl, string $apiKey, string $type): array
    {
        $client = $this->clientFactory->create([
            'timeout' => 30,
            'verify' => false,
        ]);

        $response = $client->get($apiUrl, [
            'headers' => [
                'Authorization' => 'Bearer ' . $apiKey,
                'Content-Type' => 'application/json',
            ],
            'query' => [
                'with_info' => 1,
                'type' => $type,
            ],
        ]);

        $body = $response->getBody()->getContents();
        $data = json_decode($body, true);

        if (! isset($data['data']) || ! is_array($data['data'])) {
            $this->logger->warning('API返回格式错误', [
                'api_url' => $apiUrl,
                'type' => $type,
                'response' => $body,
            ]);
            return [];
        }

        $this->logger->info('成功从API拉取模型', [
            'api_url' => $apiUrl,
            'type' => $type,
            'model_count' => count($data['data']),
        ]);

        return $data['data'];
    }

    /**
     * 将模型同步到数据库.
     */
    private function syncModelsToDatabase(
        ProviderDataIsolation $dataIsolation,
        ProviderConfigEntity $providerConfigEntity,
        array $models
    ): void {
        $configId = $providerConfigEntity->getId();

        // 获取现有的所有模型
        $existingModels = $this->providerModelDomainService->getByProviderConfigId($dataIsolation, (string) $configId);

        // 建立model_id -> entity的映射
        $existingModelMap = [];
        foreach ($existingModels as $model) {
            $existingModelMap[$model->getModelId()] = $model;
        }

        // 提取新模型的model_id
        $newModelIds = array_column($models, 'id');

        // 遍历新模型，创建或更新
        foreach ($models as $modelData) {
            $modelId = $modelData['id'] ?? null;
            if (! $modelId) {
                continue;
            }

            try {
                if (isset($existingModelMap[$modelId])) {
                    // 更新现有模型
                    $this->updateModel($dataIsolation, $existingModelMap[$modelId], $modelData, $providerConfigEntity);
                } else {
                    // 创建新模型
                    $this->createModel($dataIsolation, $modelData, $providerConfigEntity);
                }
            } catch (Throwable $e) {
                $this->logger->error('同步模型失败', [
                    'model_id' => $modelId,
                    'error' => $e->getMessage(),
                ]);
                // 继续处理其他模型
            }
        }

        // 删除不再存在的模型
        foreach ($existingModelMap as $modelId => $existingModel) {
            if (! in_array($modelId, $newModelIds)) {
                try {
                    $this->providerModelDomainService->deleteById($dataIsolation, (string) $existingModel->getId());
                    $this->logger->info('删除过期模型', [
                        'model_id' => $modelId,
                        'entity_id' => $existingModel->getId(),
                    ]);
                } catch (Throwable $e) {
                    $this->logger->error('删除模型失败', [
                        'model_id' => $modelId,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }
    }

    /**
     * 创建新模型.
     */
    private function createModel(
        ProviderDataIsolation $dataIsolation,
        array $modelData,
        ProviderConfigEntity $providerConfigEntity
    ): void {
        $saveDTO = $this->modelToReqDTO($dataIsolation, $modelData, $providerConfigEntity);

        // 保存模型
        $this->providerModelDomainService->saveModel($dataIsolation, $saveDTO);

        $this->logger->info('创建新模型', [
            'model_id' => $modelData['id'],
            'name' => $saveDTO->getName(),
        ]);
    }

    /**
     * 更新现有模型.
     */
    private function updateModel(
        ProviderDataIsolation $dataIsolation,
        ProviderModelEntity $existingModel,
        array $modelData,
        ProviderConfigEntity $providerConfigEntity
    ): void {
        $saveDTO = $this->modelToReqDTO($dataIsolation, $modelData, $providerConfigEntity);

        $saveDTO->setId($existingModel->getId());
        $saveDTO->setStatus($existingModel->getStatus()); // 保持原有状态

        // 保存模型
        $this->providerModelDomainService->saveModel($dataIsolation, $saveDTO);

        $this->logger->debug('更新模型', [
            'model_id' => $modelData['id'],
            'name' => $saveDTO->getName(),
        ]);
    }

    private function modelToReqDTO(
        ProviderDataIsolation $dataIsolation,
        array $modelData,
        ProviderConfigEntity $providerConfigEntity,
    ): SaveProviderModelDTO {
        $saveDTO = new SaveProviderModelDTO();

        $saveDTO->setServiceProviderConfigId($providerConfigEntity->getId());
        $saveDTO->setModelId($modelData['id']);
        $saveDTO->setModelVersion($modelData['id']);
        $saveDTO->setName($modelData['info']['attributes']['name'] ?? $modelData['id']);
        $saveDTO->setDescription($modelData['info']['attributes']['description'] ?? '');
        $saveDTO->setIcon($modelData['info']['attributes']['icon'] ?? '');
        $saveDTO->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $saveDTO->setModelType($modelData['info']['attributes']['model_type']);
        $saveDTO->setConfig([
            'creativity' => $modelData['info']['options']['default_temperature'] ?? 0.5,
            'support_function' => $modelData['info']['options']['function_call'] ?? false,
            'support_multi_modal' => $modelData['info']['options']['multi_modal'] ?? false,
            'support_embedding' => $modelData['info']['options']['embedding'] ?? false,
            'max_tokens' => $modelData['info']['options']['max_tokens'] ?? 200000,
            'max_output_tokens' => $modelData['info']['options']['max_output_tokens'] ?? 8192,
            'support_deep_think' => false,
        ]);

        // 设置category
        $objectType = $modelData['object'] ?? 'model';
        $category = $objectType === 'image' ? Category::VLM : Category::LLM;
        $saveDTO->setCategory($category);
        return $saveDTO;
    }

    private function getUrlByProxyUrl(string $proxyUrl): ?string
    {
        return [
            'domestic_access_points' => config('services.domestic_magic_service.host') . '/v1/models',
            'international_access_point' => config('services.international_magic_service.host') . '/v1/models',
        ][$proxyUrl] ?? null;
    }
}
