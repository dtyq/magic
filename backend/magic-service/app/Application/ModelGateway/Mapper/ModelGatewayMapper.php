<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Mapper;

use App\Application\ModelGateway\Service\AggregateModelResolverService;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\ProviderModelType;
use App\Infrastructure\Core\Contract\Model\RerankInterface;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageModel;
use App\Infrastructure\ExternalAPI\MagicAIApi\MagicAILocalModel;
use App\Infrastructure\ExternalAPI\Proxy\ProxyConfigResolverInterface;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoModel;
use DateTime;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Api\RequestOptions\ApiOptions;
use Hyperf\Odin\Contract\Model\EmbeddingInterface;
use Hyperf\Odin\Contract\Model\ModelInterface;
use Hyperf\Odin\Factory\ModelFactory;
use Hyperf\Odin\Model\AbstractModel;
use Hyperf\Odin\Model\ModelOptions;
use Hyperf\Odin\ModelMapper;
use InvalidArgumentException;

/**
 * 集合项目本身多套的 ModelGatewayMapper - 最终全部转换为 odin model 参数格式.
 */
class ModelGatewayMapper extends ModelMapper
{
    /**
     * 持久化的自定义数据.
     * @var array<string, ModelAttributes>
     */
    protected array $attributes = [];

    /**
     * @var array<string, RerankInterface>
     */
    protected array $rerank = [];

    private ProviderManager $providerManager;

    public function __construct(protected ConfigInterface $config, LoggerFactory $loggerFactory)
    {
        $this->providerManager = di(ProviderManager::class);
        $logger = $loggerFactory->get('ModelGatewayMapper');
        $this->models['chat'] = [];
        $this->models['embedding'] = [];
        parent::__construct($config, $logger);

        $this->loadEnvModels();
    }

    public function exists(BaseDataIsolation $dataIsolation, string $model): bool
    {
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        if (isset($this->models['chat'][$model]) || isset($this->models['embedding'][$model])) {
            return true;
        }
        return (bool) $this->getByAdmin($dataIsolation, $model);
    }

    public function getOfficialChatModelProxy(string $model): MagicAILocalModel
    {
        $dataIsolation = ModelGatewayDataIsolation::create('', '');
        $dataIsolation->setCurrentOrganizationCode($dataIsolation->getOfficialOrganizationCode());
        return $this->getChatModelProxy($dataIsolation, $model, true);
    }

    /**
     * 内部使用 chat 时，一定是使用该方法.
     * 会自动替代为本地代理模型.
     */
    public function getChatModelProxy(BaseDataIsolation $dataIsolation, string $model, bool $useOfficialAccessToken = false): MagicAILocalModel
    {
        $models = explode(',', $model);
        $firstModel = trim($models[0]);
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        $odinModel = $this->getOrganizationChatModel($dataIsolation, $firstModel);
        if ($odinModel instanceof ModelEntry) {
            $odinModel = $odinModel->getOdinModel()?->getModel();
        }
        if (! $odinModel instanceof AbstractModel) {
            throw new InvalidArgumentException(sprintf('Model %s is not a valid Odin model.', $model));
        }
        return $this->createProxy($dataIsolation, $model, $odinModel->getModelOptions(), $odinModel->getApiRequestOptions(), $useOfficialAccessToken);
    }

    /**
     * 内部使用 embedding 时，一定是使用该方法.
     * 会自动替代为本地代理模型.
     */
    public function getEmbeddingModelProxy(BaseDataIsolation $dataIsolation, string $model): MagicAILocalModel
    {
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        $odinModel = $this->getOrganizationEmbeddingModel($dataIsolation, $model);
        if ($odinModel instanceof ModelEntry) {
            $odinModel = $odinModel->getOdinModel()?->getModel();
        }
        if (! $odinModel instanceof AbstractModel) {
            throw new InvalidArgumentException(sprintf('Model %s is not a valid Odin model.', $model));
        }
        // 转换为代理
        return $this->createProxy($dataIsolation, $model, $odinModel->getModelOptions(), $odinModel->getApiRequestOptions());
    }

    /**
     * 该方法获取到的一定是真实调用的模型.
     * 仅 ModelGateway 领域使用.
     * @param string $model 预期是管理后台的 model_id，过度阶段接受传入 model_version
     */
    public function getOrganizationChatModel(BaseDataIsolation $dataIsolation, string $model): ModelEntry|ModelInterface
    {
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        $entry = $this->getByAdmin($dataIsolation, $model, ModelType::LLM);
        if ($entry) {
            return $entry;
        }
        return $this->getChatModel($model);
    }

    /**
     * 该方法获取到的一定是真实调用的模型.
     * 仅 ModelGateway 领域使用.
     * @param string $model 模型名称 预期是管理后台的 model_id，过度阶段接受 model_version
     */
    public function getOrganizationEmbeddingModel(BaseDataIsolation $dataIsolation, string $model): EmbeddingInterface|ModelEntry
    {
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        $entry = $this->getByAdmin($dataIsolation, $model, ModelType::EMBEDDING);
        if ($entry) {
            return $entry;
        }
        return $this->getEmbeddingModel($model);
    }

    public function getOrganizationImageModel(BaseDataIsolation $dataIsolation, string $model): ?ModelEntry
    {
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        $entry = $this->getByAdmin($dataIsolation, $model);

        if ($entry instanceof ModelEntry && $entry->isImageModel()) {
            return $entry;
        }

        return null;
    }

    public function getOrganizationVideoModel(BaseDataIsolation $dataIsolation, string $model): ?ModelEntry
    {
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        $entry = $this->getByAdmin($dataIsolation, $model);

        if ($entry instanceof ModelEntry && $entry->isVideoModel()) {
            return $entry;
        }

        return null;
    }

    /**
     * 获取当前组织下的所有可用 chat 模型.
     * @return ModelEntry[]
     */
    public function getChatModels(BaseDataIsolation $dataIsolation, bool $withDynamicModels = false): array
    {
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        return $this->getModelsByType($dataIsolation, [ModelType::LLM], $withDynamicModels);
    }

    /**
     * 获取当前组织下的所有可用 embedding 模型.
     * @return ModelEntry[]
     */
    public function getEmbeddingModels(BaseDataIsolation $dataIsolation, bool $withDynamicModels = false): array
    {
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        return $this->getModelsByType($dataIsolation, [ModelType::EMBEDDING], $withDynamicModels);
    }

    /**
     * get all available image models under the current organization.
     * @return ModelEntry[]
     */
    public function getImageModels(BaseDataIsolation $dataIsolation, bool $withDynamicModels = false): array
    {
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        return $this->getModelsByType($dataIsolation, [ModelType::TEXT_TO_IMAGE, ModelType::IMAGE_TO_IMAGE], $withDynamicModels);
    }

    /**
     * get all available video models under the current organization.
     * @return ModelEntry[]
     */
    public function getVideoModels(BaseDataIsolation $dataIsolation, bool $withDynamicModels = false): array
    {
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        return $this->getModelsByType($dataIsolation, [ModelType::TEXT_TO_VIDEO], $withDynamicModels);
    }

    /**
     * 获取当前组织下所有类型的可用模型.
     * @return ModelEntry[]
     */
    public function getAllModels(BaseDataIsolation $dataIsolation, bool $withDynamicModels = false): array
    {
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        return $this->getModelsByType($dataIsolation, [ModelType::LLM, ModelType::EMBEDDING, ModelType::TEXT_TO_IMAGE, ModelType::IMAGE_TO_IMAGE, ModelType::TEXT_TO_VIDEO], $withDynamicModels);
    }

    protected function loadEnvModels(): void
    {
        // env 添加的模型增加上 attributes
        /**
         * @var string $name
         * @var AbstractModel $model
         */
        foreach ($this->models['chat'] as $name => $model) {
            $key = $name;
            $this->attributes[$key] = new ModelAttributes(
                key: $key,
                name: $name,
                label: $name,
                icon: '',
                tags: [['type' => 1, 'value' => 'MagicAI']],
                createdAt: new DateTime(),
                owner: 'MagicOdin',
                description: '',
                resolvedModelId: $key,
            );
            $this->logger->info('EnvModelRegister', [
                'key' => $name,
                'model' => $model->getModelName(),
                'implementation' => get_class($model),
            ]);
        }
        foreach ($this->models['embedding'] as $name => $model) {
            $key = $name;
            $this->attributes[$key] = new ModelAttributes(
                key: $key,
                name: $name,
                label: $name,
                icon: '',
                tags: [['type' => 1, 'value' => 'MagicAI']],
                createdAt: new DateTime(),
                owner: 'MagicOdin',
                description: '',
                resolvedModelId: $key,
            );
            $this->logger->info('EnvModelRegister', [
                'key' => $name,
                'model' => $model->getModelName(),
                'implementation' => get_class($model),
                'vector_size' => $model->getModelOptions()->getVectorSize(),
            ]);
        }
    }

    /**
     * 获取当前组织下指定类型的所有可用模型，支持同时查询多种类型.
     *
     * @param ModelType[] $modelTypes 需要查询的模型类型，不可为空
     * @return ModelEntry[]
     */
    private function getModelsByType(ModelGatewayDataIsolation $dataIsolation, array $modelTypes, bool $withDynamicModels = false): array
    {
        $list = [];

        // 加载 env 模型（仅 LLM/EMBEDDING 有 env 模型，其他类型跳过）
        foreach ($modelTypes as $modelType) {
            if ($modelType->isLLM()) {
                foreach ($this->getModels('chat') as $name => $model) {
                    if ($model instanceof AbstractModel && ! $model->getModelOptions()->isChat()) {
                        continue;
                    }
                    $list[$name] = new ModelEntry(
                        attributes: $this->attributes[$name],
                        model: new OdinModel(key: $name, model: $model),
                    );
                }
            } elseif ($modelType->isEmbedding()) {
                foreach ($this->getModels('embedding') as $name => $model) {
                    if ($model instanceof AbstractModel && ! $model->getModelOptions()->isEmbedding()) {
                        continue;
                    }
                    $list[$name] = new ModelEntry(
                        attributes: $this->attributes[$name],
                        model: new OdinModel(key: $name, model: $model),
                    );
                }
            }
        }

        // 合并多个类型的可用模型 ID，任意类型返回 null（不限制）则整体不限制
        $availableModelIds = [];
        foreach ($modelTypes as $modelType) {
            $ids = $dataIsolation->getSubscriptionManager()->getAvailableModelIds($modelType);
            if ($ids === null) {
                $availableModelIds = null;
                break;
            }
            foreach ($ids as $id) {
                $availableModelIds[$id] = true;
            }
        }
        if (is_array($availableModelIds)) {
            $availableModelIds = array_keys($availableModelIds);
        }

        // 需要包含官方组织的数据
        $providerDataIsolation = $this->createProviderDataIsolationWithOfficial($dataIsolation);

        // 加载 模型
        $providerModels = $this->providerManager->getModelsByModelIds($providerDataIsolation, $availableModelIds, $modelTypes);

        $modelLogs = [];

        $providerConfigIds = [];
        foreach ($providerModels as $providerModel) {
            $providerConfigIds[] = $providerModel->getServiceProviderConfigId();
        }
        $providerConfigIds = array_unique($providerConfigIds);

        // 加载 服务商配置
        $providerConfigs = $this->providerManager->getProviderConfigsByIds($providerDataIsolation, $providerConfigIds);
        $providerIds = [];
        foreach ($providerConfigs as $providerConfig) {
            $providerIds[] = $providerConfig->getServiceProviderId();
        }

        // 获取 服务商
        $providers = $this->providerManager->getProvidersByIds($providerDataIsolation, $providerIds);

        // 预先批量解析所有 providerConfig 对应的 proxy 字符串，避免循环内重复查询
        $proxyCache = $this->resolveProxyConfigs($providerConfigs);

        // 第一遍：组装原子模型，暂存 DYNAMIC 待第二遍处理
        $pendingDynamicModels = [];
        foreach ($providerModels as $providerModel) {
            if ($providerModel->getType() === ProviderModelType::DYNAMIC) {
                if ($withDynamicModels) {
                    $pendingDynamicModels[] = $providerModel;
                }
                continue;
            }
            if (! $providerConfig = $providerConfigs[$providerModel->getServiceProviderConfigId()] ?? null) {
                $modelLogs['provider_config_not_found'][] = "{$providerModel->getServiceProviderConfigId()}|{$providerModel->getModelId()}";
                continue;
            }
            $providerLabel = $providerConfig->getAlias() ?: (string) $providerConfig->getId();
            if (! $providerConfig->getStatus()->isEnabled()) {
                $modelLogs['provider_config_disabled'][] = "{$providerLabel}|{$providerModel->getModelId()}";
                continue;
            }
            if (! $provider = $providers[$providerConfig->getServiceProviderId()] ?? null) {
                $modelLogs['provider_not_found'][] = "{$providerLabel}|{$providerModel->getModelId()}";
                continue;
            }
            $proxy = $proxyCache[$providerModel->getServiceProviderConfigId()] ?? '';
            $model = $this->createModelByProvider($providerDataIsolation, $providerModel, $providerConfig, $provider, $proxy);
            if (! $model) {
                $modelLogs['model_disabled_or_invalid'][] = "{$providerLabel}|{$providerModel->getModelId()}";
                continue;
            }
            $modelLogs['success'][] = "{$providerLabel}|{$providerModel->getModelId()}";
            $list[$model->getKey()] = $model;
        }

        // 第二遍：所有原子模型就绪后，再处理 DYNAMIC 模型
        foreach ($pendingDynamicModels as $providerModel) {
            $dynamicModel = $this->createDynamicOdinModel($providerModel, $list, $dataIsolation);
            if (! $dynamicModel) {
                continue;
            }
            $list[$dynamicModel->getKey()] = $dynamicModel;
            $modelLogs['success'][] = "dynamic|{$providerModel->getModelId()}|{$dynamicModel->getAttributes()->getResolvedModelId()}";
        }

        // 按照 $availableModelIds 排序
        if ($availableModelIds !== null) {
            $orderedList = [];
            foreach ($availableModelIds as $modelId) {
                if (isset($list[$modelId])) {
                    $orderedList[$modelId] = $list[$modelId];
                }
            }
            $list = $orderedList;
        }

        $this->logger->info('模型加载结果', $modelLogs);

        return $list;
    }

    /**
     * 批量解析 providerConfig 列表对应的 proxy 字符串.
     * 以 providerConfigId 为 key 缓存结果，相同 proxy_server_id 只查询一次数据库.
     *
     * @param ProviderConfigEntity[] $providerConfigs key 为 providerConfigId
     * @return array<int, string> key 为 providerConfigId，value 为 proxy 字符串（空字符串表示不使用代理）
     */
    private function resolveProxyConfigs(array $providerConfigs): array
    {
        $resolver = di(ProxyConfigResolverInterface::class);
        $proxyCache = [];
        // 按 proxy_server_id 缓存解析结果，避免多个 providerConfig 指向同一 proxy 时重复查库
        $proxyServerCache = [];

        foreach ($providerConfigs as $configId => $providerConfig) {
            $configItem = $providerConfig->getConfig();
            if ($configItem === null || ! $configItem->getUseProxy()) {
                $proxyCache[$configId] = '';
                continue;
            }
            $proxyServerId = $configItem->getProxyServer()['id'] ?? null;
            if ($proxyServerId !== null && array_key_exists($proxyServerId, $proxyServerCache)) {
                $proxyCache[$configId] = $proxyServerCache[$proxyServerId];
                continue;
            }
            $resolved = (string) ($resolver->resolve($configItem->toArray()) ?? '');
            if ($proxyServerId !== null) {
                $proxyServerCache[$proxyServerId] = $resolved;
            }
            $proxyCache[$configId] = $resolved;
        }

        return $proxyCache;
    }

    /**
     * 创建包含官方组织的 ProviderDataIsolation.
     */
    private function createProviderDataIsolationWithOfficial(BaseDataIsolation $dataIsolation): ProviderDataIsolation
    {
        $providerDataIsolation = ProviderDataIsolation::createByBaseDataIsolation($dataIsolation);
        $providerDataIsolation->setContainOfficialOrganization(true);
        return $providerDataIsolation;
    }

    /**
     * 将单个 DYNAMIC 类型的 ProviderModelEntity 解析为 ModelEntry.
     * 使用订阅管理器做实时权限判断，resolvedModelId 与请求时实际使用的模型保持一致.
     * 解析失败（无可用子模型或子模型不在可用列表中）时返回 null.
     *
     * @param ModelEntry[] $atomList 已构建好的原子模型列表
     */
    private function createDynamicOdinModel(
        ProviderModelEntity $dynamicModel,
        array $atomList,
        ModelGatewayDataIsolation $dataIsolation,
    ): ?ModelEntry {
        $aggregateResolver = di(AggregateModelResolverService::class);
        $resolvedModelId = $aggregateResolver->resolveModel($dynamicModel, $dataIsolation);
        if (! $resolvedModelId) {
            $this->logger->debug('动态模型无可用子模型，跳过', ['model_id' => $dynamicModel->getModelId()]);
            return null;
        }

        $resolvedEntry = $atomList[$resolvedModelId] ?? null;
        if (! $resolvedEntry instanceof ModelEntry) {
            $this->logger->debug('动态模型解析的子模型不在可用列表中', [
                'dynamic_model_id' => $dynamicModel->getModelId(),
                'resolved_model_id' => $resolvedModelId,
            ]);
            return null;
        }

        $dynamicModelId = $dynamicModel->getModelId();
        $dynamicAttributes = new ModelAttributes(
            key: $dynamicModelId,
            name: $dynamicModel->getModelId(),
            label: $dynamicModel->getName(),
            icon: $dynamicModel->getIcon(),
            tags: [['type' => 1, 'value' => 'Magic']],
            createdAt: $dynamicModel->getCreatedAt() ?? new DateTime(),
            owner: 'MagicAI',
            providerAlias: '',
            providerModelId: (string) $dynamicModel->getId(),
            modelType: $dynamicModel->getModelType()->value,
            description: $dynamicModel->getLocalizedDescription($dataIsolation->getLanguage()),
            resolvedModelId: $resolvedModelId,
        );

        $resolvedImpl = $resolvedEntry->getModel();
        $model = match (true) {
            $resolvedImpl instanceof OdinModel => new OdinModel(
                key: $dynamicModelId,
                model: $this->buildDynamicUnderlyingModel($resolvedImpl->getModel()),
            ),
            $resolvedImpl instanceof VideoModel => new VideoModel(
                $resolvedImpl->getConfig(),
                $resolvedImpl->getModelVersion(),
                $resolvedImpl->getProviderModelId(),
                $resolvedImpl->getProviderCode(),
            ),
            default => new ImageModel(
                $resolvedImpl->getConfig(),
                $resolvedImpl->getModelVersion(),
                $resolvedImpl->getProviderModelId(),
                $resolvedImpl->getProviderCode(),
            ),
        };

        return new ModelEntry(attributes: $dynamicAttributes, model: $model);
    }

    private function createModelByProvider(
        ProviderDataIsolation $providerDataIsolation,
        ProviderModelEntity $providerModelEntity,
        ProviderConfigEntity $providerConfigEntity,
        ProviderEntity $providerEntity,
        string $proxy = '',
    ): ?ModelEntry {
        if (! $providerDataIsolation->isOfficialOrganization() && (! $providerModelEntity->getStatus()->isEnabled() || ! $providerConfigEntity->getStatus()->isEnabled())) {
            return null;
        }

        $chat = false;
        $functionCall = false;
        $multiModal = false;
        $embedding = false;
        $vectorSize = 0;
        if ($providerModelEntity->getModelType()->isLLM()) {
            $chat = true;
            $functionCall = $providerModelEntity->getConfig()?->isSupportFunction();
            $multiModal = $providerModelEntity->getConfig()?->isSupportMultiModal();
        } elseif ($providerModelEntity->getModelType()->isEmbedding()) {
            $embedding = true;
            $vectorSize = $providerModelEntity->getConfig()?->getVectorSize();
        }

        $key = $providerModelEntity->getModelId();

        $implementation = $providerEntity->getProviderCode()->getImplementation();
        $providerConfigItem = $providerConfigEntity->getConfig();
        $implementationConfig = $providerEntity->getProviderCode()->getImplementationConfig($providerConfigItem, $providerModelEntity->getModelVersion());

        if ($providerEntity->getProviderType()->isCustom()) {
            // 自定义服务商统一显示别名，如果没有别名则显示“自定义服务商”（需要考虑多语言）
            $providerName = $providerConfigEntity->getLocalizedAlias($providerDataIsolation->getLanguage());
        } else {
            // 内置服务商的统一显示 服务商名称，不用显示别名（需要考虑多语言）
            $providerName = $providerEntity->getLocalizedName($providerDataIsolation->getLanguage());
        }

        // 如果不是官方组织，但是模型是官方组织，统一显示 Magic
        if (! $providerDataIsolation->isOfficialOrganization()
            && in_array($providerConfigEntity->getOrganizationCode(), $providerDataIsolation->getOfficialOrganizationCodes())) {
            $providerName = 'Magic';
        }

        $attributes = new ModelAttributes(
            key: $key,
            name: $providerModelEntity->getModelId(),
            label: $providerModelEntity->getName(),
            icon: $providerModelEntity->getIcon(),
            tags: [['type' => 1, 'value' => "{$providerName}"]],
            createdAt: $providerEntity->getCreatedAt(),
            owner: 'MagicAI',
            providerAlias: $providerConfigEntity->getAlias() ?? $providerEntity->getName(),
            providerModelId: (string) $providerModelEntity->getId(),
            providerId: (string) $providerConfigEntity->getId(),
            modelType: $providerModelEntity->getModelType()->value,
            description: $providerModelEntity->getLocalizedDescription($providerDataIsolation->getLanguage()),
            resolvedModelId: $key,
        );

        if ($providerModelEntity->getModelType()->isVLM()) {
            return new ModelEntry(
                attributes: $attributes,
                model: new ImageModel($providerConfigItem->toArray(), $providerModelEntity->getModelVersion(), (string) $providerModelEntity->getId(), $providerEntity->getProviderCode()),
            );
        }

        if ($providerModelEntity->getModelType()->isVideoGeneration()) {
            return new ModelEntry(
                attributes: $attributes,
                model: new VideoModel($providerConfigItem->toArray(), $providerModelEntity->getModelVersion(), (string) $providerModelEntity->getId(), $providerEntity->getProviderCode()),
            );
        }

        return new ModelEntry(
            attributes: $attributes,
            model: new OdinModel(
                key: $key,
                model: $this->createModel($providerModelEntity->getModelVersion(), [
                    'model' => $providerModelEntity->getModelVersion(),
                    'implementation' => $implementation,
                    'config' => $implementationConfig,
                    'model_options' => [
                        'chat' => $chat,
                        'function_call' => $functionCall,
                        'embedding' => $embedding,
                        'multi_modal' => $multiModal,
                        'vector_size' => $vectorSize,
                        'max_tokens' => $providerModelEntity->getConfig()?->getMaxTokens(),
                        'max_output_tokens' => $providerModelEntity->getConfig()?->getMaxOutputTokens(),
                        'default_temperature' => $providerModelEntity->getConfig()?->getCreativity(),
                        'fixed_temperature' => $providerModelEntity->getConfig()?->getTemperature(),
                    ],
                    'api_options' => [
                        'proxy' => $proxy,
                    ],
                ]),
            ),
        );
    }

    private function getByAdmin(ModelGatewayDataIsolation $dataIsolation, string $model, ?ModelType $modelType = null): ?ModelEntry
    {
        $providerDataIsolation = ProviderDataIsolation::createByBaseDataIsolation($dataIsolation);
        $providerDataIsolation->setContainOfficialOrganization(true);

        $checkStatus = true;
        if ($dataIsolation->isOfficialOrganization()) {
            $checkStatus = false;
        }

        // 获取模型
        $providerModelEntity = $this->providerManager->getAvailableByModelIdOrId($providerDataIsolation, $model, $checkStatus);
        if (! $providerModelEntity) {
            $this->logger->info('模型不存在', ['model' => $model]);
            return null;
        }
        if (! $dataIsolation->isOfficialOrganization() && ! $providerModelEntity->getStatus()->isEnabled()) {
            $this->logger->info('模型被禁用', ['model' => $model]);
            return null;
        }
        // 检查当前套餐是否有这个模型的使用权限 - 目前只有 LLM 模型有这个限制
        if ($providerModelEntity->getModelType()->isLLM()) {
            if (! $dataIsolation->isOfficialOrganization() && ! $dataIsolation->getSubscriptionManager()->isValidModelAvailable($providerModelEntity->getModelId(), $modelType)) {
                $this->logger->info('模型不在可用名单', ['model' => $providerModelEntity->getModelId(), 'model_type' => $modelType?->value]);
                return null;
            }
        }

        // 获取配置
        $providerConfigEntity = $this->providerManager->getProviderConfigsByIds($providerDataIsolation, [$providerModelEntity->getServiceProviderConfigId()])[$providerModelEntity->getServiceProviderConfigId()] ?? null;
        if (! $providerConfigEntity) {
            $this->logger->info('服务商配置不存在', ['model' => $model, 'provider_config_id' => $providerModelEntity->getServiceProviderConfigId()]);
            return null;
        }
        if (! $dataIsolation->isOfficialOrganization() && ! $providerConfigEntity->getStatus()->isEnabled()) {
            $this->logger->info('服务商配置被禁用', ['model' => $model, 'provider_config_id' => $providerModelEntity->getServiceProviderConfigId()]);
            return null;
        }

        // 获取服务商
        $providerEntity = $this->providerManager->getProvidersByIds($providerDataIsolation, [$providerConfigEntity->getServiceProviderId()])[$providerConfigEntity->getServiceProviderId()] ?? null;

        if (! $providerEntity) {
            $this->logger->info('服务商不存在', ['model' => $model, 'provider_id' => $providerConfigEntity->getServiceProviderId()]);
            return null;
        }

        $proxy = '';
        $configItem = $providerConfigEntity->getConfig();
        if ($configItem !== null && $configItem->getUseProxy()) {
            $proxy = (string) (di(ProxyConfigResolverInterface::class)->resolve($configItem->toArray()) ?? '');
        }

        return $this->createModelByProvider($providerDataIsolation, $providerModelEntity, $providerConfigEntity, $providerEntity, $proxy);
    }

    private function createProxy(ModelGatewayDataIsolation $dataIsolation, string $model, ModelOptions $modelOptions, ApiOptions $apiOptions, bool $useOfficialAccessToken = false): MagicAILocalModel
    {
        // 使用ModelFactory创建模型实例
        $odinModel = ModelFactory::create(
            MagicAILocalModel::class,
            $model,
            [
                'use_official_access_token' => $useOfficialAccessToken,
                'vector_size' => $modelOptions->getVectorSize(),
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'user_id' => $dataIsolation->getCurrentUserId(),
            ],
            $modelOptions,
            $apiOptions,
            $this->logger
        );
        if (! $odinModel instanceof MagicAILocalModel) {
            throw new InvalidArgumentException(sprintf('Implementation %s is not defined.', MagicAILocalModel::class));
        }
        return $odinModel;
    }

    /**
     * 为动态模型构建底层 model 实例。
     * 则在 atom model 选项的基础上进行覆盖；否则直接复用 atom model。
     * 只有 AbstractModel 才持有 ModelOptions，非 AbstractModel 时原样返回。
     */
    private function buildDynamicUnderlyingModel(
        EmbeddingInterface|ModelInterface $atomModel,
    ): EmbeddingInterface|ModelInterface {
        if (! $atomModel instanceof AbstractModel) {
            return $atomModel;
        }

        $cloned = clone $atomModel;
        $cloned->setModelOptions(new ModelOptions($atomModel->getModelOptions()->toArray()));
        return $cloned;
    }
}
