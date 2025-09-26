<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Mapper;

use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\Infrastructure\Core\Contract\Model\RerankInterface;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Model\ImageGenerationModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageModel;
use App\Infrastructure\ExternalAPI\MagicAIApi\MagicAILocalModel;
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
use Throwable;

/**
 * 集合项目本身多套的 ModelGatewayMapper - 最终全部转换为 odin model 参数格式.
 */
class ModelGatewayMapper extends ModelMapper
{
    /**
     * 持久化的自定义数据.
     * @var array<string, OdinModelAttributes>
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

    /**
     * 内部使用 chat 时，一定是使用该方法.
     * 会自动替代为本地代理模型.
     */
    public function getChatModelProxy(BaseDataIsolation $dataIsolation, string $model): MagicAILocalModel
    {
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        $odinModel = $this->getOrganizationChatModel($dataIsolation, $model);
        if ($odinModel instanceof OdinModel) {
            $odinModel = $odinModel->getModel();
        }
        if (! $odinModel instanceof AbstractModel) {
            throw new InvalidArgumentException(sprintf('Model %s is not a valid Odin model.', $model));
        }
        return $this->createProxy($model, $odinModel->getModelOptions(), $odinModel->getApiRequestOptions());
    }

    /**
     * 内部使用 embedding 时，一定是使用该方法.
     * 会自动替代为本地代理模型.
     */
    public function getEmbeddingModelProxy(BaseDataIsolation $dataIsolation, string $model): MagicAILocalModel
    {
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        /** @var AbstractModel $odinModel */
        $odinModel = $this->getOrganizationEmbeddingModel($dataIsolation, $model);
        if ($odinModel instanceof OdinModel) {
            $odinModel = $odinModel->getModel();
        }
        if (! $odinModel instanceof AbstractModel) {
            throw new InvalidArgumentException(sprintf('Model %s is not a valid Odin model.', $model));
        }
        // 转换为代理
        return $this->createProxy($model, $odinModel->getModelOptions(), $odinModel->getApiRequestOptions());
    }

    /**
     * 该方法获取到的一定是真实调用的模型.
     * 仅 ModelGateway 领域使用.
     * @param string $model 预期是管理后台的 model_id，过度阶段接受传入 model_version
     */
    public function getOrganizationChatModel(BaseDataIsolation $dataIsolation, string $model): ModelInterface|OdinModel
    {
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        $odinModel = $this->getByAdmin($dataIsolation, $model, ModelType::LLM);
        if ($odinModel) {
            return $odinModel;
        }
        return $this->getChatModel($model);
    }

    /**
     * 该方法获取到的一定是真实调用的模型.
     * 仅 ModelGateway 领域使用.
     * @param string $model 模型名称 预期是管理后台的 model_id，过度阶段接受 model_version
     */
    public function getOrganizationEmbeddingModel(BaseDataIsolation $dataIsolation, string $model): EmbeddingInterface|OdinModel
    {
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        $odinModel = $this->getByAdmin($dataIsolation, $model, ModelType::EMBEDDING);
        if ($odinModel) {
            return $odinModel;
        }
        return $this->getEmbeddingModel($model);
    }

    public function getOrganizationImageModel(BaseDataIsolation $dataIsolation, string $model): ?ImageModel
    {
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        $result = $this->getByAdmin($dataIsolation, $model);

        // 只返回 ImageGenerationModelWrapper 类型的结果
        if ($result instanceof ImageModel) {
            return $result;
        }

        return null;
    }

    /**
     * 获取当前组织下的所有可用 chat 模型.
     * @return OdinModel[]
     */
    public function getChatModels(BaseDataIsolation $dataIsolation): array
    {
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        return $this->getModelsByType($dataIsolation, ModelType::LLM);
    }

    /**
     * 获取当前组织下的所有可用 embedding 模型.
     * @return OdinModel[]
     */
    public function getEmbeddingModels(BaseDataIsolation $dataIsolation): array
    {
        $dataIsolation = ModelGatewayDataIsolation::createByBaseDataIsolation($dataIsolation);
        return $this->getModelsByType($dataIsolation, ModelType::EMBEDDING);
    }

    /**
     * get all available image models under the current organization.
     * @return OdinModel[]
     */
    public function getImageModels(BaseDataIsolation $dataIsolation): array
    {
        $serviceProviderDomainService = di(AdminProviderDomainService::class);
        $officeModels = $serviceProviderDomainService->getOfficeModels(Category::VLM);

        $odinModels = [];
        foreach ($officeModels as $model) {
            $key = $model->getModelVersion();

            // Create virtual image generation model
            $imageModel = new ImageGenerationModel(
                $model->getModelVersion(),
                [], // Empty config array
                $this->logger
            );

            // Create model attributes
            $attributes = new OdinModelAttributes(
                key: $key,
                name: $model->getModelVersion(),
                label: $model->getName() ?: 'Image Generation',
                icon: $model->getIcon() ?: '',
                tags: [['type' => 1, 'value' => 'Image Generation']],
                createdAt: $model->getCreatedAt() ?? new DateTime(),
                owner: 'MagicAI',
                providerAlias: '',
                providerModelId: (string) $model->getId()
            );

            // Create OdinModel
            $odinModel = new OdinModel($key, $imageModel, $attributes);
            $odinModels[$key] = $odinModel;
        }

        return $odinModels;
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
            $this->attributes[$key] = new OdinModelAttributes(
                key: $key,
                name: $name,
                label: $name,
                icon: '',
                tags: [['type' => 1, 'value' => 'MagicAI']],
                createdAt: new DateTime(),
                owner: 'MagicOdin',
            );
            $this->logger->info('EnvModelRegister', [
                'key' => $name,
                'model' => $model->getModelName(),
                'implementation' => get_class($model),
            ]);
        }
        foreach ($this->models['embedding'] as $name => $model) {
            $key = $name;
            $this->attributes[$key] = new OdinModelAttributes(
                key: $key,
                name: $name,
                label: $name,
                icon: '',
                tags: [['type' => 1, 'value' => 'MagicAI']],
                createdAt: new DateTime(),
                owner: 'MagicOdin',
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
     * 获取当前组织下指定类型的所有可用模型.
     * @return OdinModel[]
     */
    private function getModelsByType(ModelGatewayDataIsolation $dataIsolation, ModelType $modelType): array
    {
        $list = [];

        // 获取已持久化的配置
        $models = $this->getModels($modelType->isLLM() ? 'chat' : 'embedding');
        foreach ($models as $name => $model) {
            switch ($modelType) {
                case ModelType::LLM:
                    if ($model instanceof AbstractModel && ! $model->getModelOptions()->isChat()) {
                        continue 2;
                    }
                    break;
                case ModelType::EMBEDDING:
                    if ($model instanceof AbstractModel && ! $model->getModelOptions()->isEmbedding()) {
                        continue 2;
                    }
                    break;
                default:
                    // 如果没有指定类型，则全部添加
                    break;
            }
            $list[$name] = new OdinModel(key: $name, model: $model, attributes: $this->attributes[$name]);
        }

        // 获取当前套餐下的可用模型
        $availableModelIds = $dataIsolation->getSubscriptionManager()->getAvailableModelIds($modelType);

        // 需要包含官方组织的数据
        $providerDataIsolation = ProviderDataIsolation::createByBaseDataIsolation($dataIsolation);
        $providerDataIsolation->setContainOfficialOrganization(true);

        // 加载 模型
        $providerModels = $this->providerManager->getModelsByModelIds($providerDataIsolation, $availableModelIds, $modelType);

        $modelLogs = [];

        $providerConfigIds = [];
        foreach ($providerModels as $providerModel) {
            $providerConfigIds[] = $providerModel->getServiceProviderConfigId();
            $modelLogs[$providerModel->getModelId()] = [
                'model_id' => $providerModel->getModelId(),
                'provider_config_id' => (string) $providerModel->getServiceProviderConfigId(),
                'is_office' => $providerModel->isOffice(),
            ];
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

        // 组装数据
        foreach ($providerModels as $providerModel) {
            if (! $providerConfig = $providerConfigs[$providerModel->getServiceProviderConfigId()] ?? null) {
                $modelLogs[$providerModel->getModelId()]['error'] = 'ProviderConfig not found';
                continue;
            }
            if (! $providerConfig->getStatus()->isEnabled()) {
                $modelLogs[$providerModel->getModelId()]['error'] = 'ProviderConfig disabled';
                continue;
            }
            if (! $provider = $providers[$providerConfig->getServiceProviderId()] ?? null) {
                $modelLogs[$providerModel->getModelId()]['error'] = 'Provider not found';
                continue;
            }
            $model = $this->createModelByProvider($providerDataIsolation, $providerModel, $providerConfig, $provider);
            if (! $model) {
                $modelLogs[$providerModel->getModelId()]['error'] = 'Model disabled or invalid';
                continue;
            }
            $list[$model->getAttributes()->getKey()] = $model;
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

        $this->logger->info('检索到模型', $modelLogs);

        return $list;
    }

    private function createModelByProvider(
        ProviderDataIsolation $providerDataIsolation,
        ProviderModelEntity $providerModelEntity,
        ProviderConfigEntity $providerConfigEntity,
        ProviderEntity $providerEntity,
    ): null|ImageModel|OdinModel {
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

        try {
            $fileDomainService = di(FileDomainService::class);
            // 如果是官方组织的 icon，切换官方组织
            if ($providerModelEntity->isOffice()) {
                $iconUrl = $fileDomainService->getLink($providerDataIsolation->getOfficialOrganizationCode(), $providerModelEntity->getIcon())?->getUrl() ?? '';
            } else {
                $iconUrl = $fileDomainService->getLink($providerModelEntity->getOrganizationCode(), $providerModelEntity->getIcon())?->getUrl() ?? '';
            }
        } catch (Throwable $e) {
            $iconUrl = '';
        }

        // 根据模型类型返回不同的包装对象
        if ($providerModelEntity->getModelType()->isVLM()) {
            return new ImageModel($providerConfigItem->toArray(), $providerModelEntity->getModelVersion(), (string) $providerModelEntity->getId());
        }

        // 对于LLM/Embedding模型，保持原有逻辑
        return new OdinModel(
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
                ],
            ]),
            attributes: new OdinModelAttributes(
                key: $key,
                name: $providerModelEntity->getModelId(),
                label: $providerModelEntity->getName(),
                icon: $iconUrl,
                tags: [['type' => 1, 'value' => "{$providerName}"]],
                createdAt: $providerEntity->getCreatedAt(),
                owner: 'MagicAI',
                providerAlias: $providerConfigEntity->getAlias() ?? $providerEntity->getName(),
                providerModelId: (string) $providerModelEntity->getId(),
                providerId: (string) $providerConfigEntity->getId(),
            )
        );
    }

    private function getByAdmin(ModelGatewayDataIsolation $dataIsolation, string $model, ?ModelType $modelType = null): null|ImageModel|OdinModel
    {
        $providerDataIsolation = ProviderDataIsolation::createByBaseDataIsolation($dataIsolation);
        $providerDataIsolation->setContainOfficialOrganization(true);

        // 获取模型
        $providerModelEntity = $this->providerManager->getAvailableByModelIdOrId($providerDataIsolation, $model);
        if (! $providerModelEntity) {
            $this->logger->info('模型不存在', ['model' => $model]);
            return null;
        }
        if (! $dataIsolation->isOfficialOrganization() && ! $providerModelEntity->getStatus()->isEnabled()) {
            $this->logger->info('模型被禁用', ['model' => $model]);
            return null;
        }

        // 检查当前套餐是否有这个模型的使用权限
        if (! $dataIsolation->isOfficialOrganization() && ! $dataIsolation->getSubscriptionManager()->isValidModelAvailable($providerModelEntity->getModelId(), $modelType)) {
            $this->logger->info('模型不在可用名单', ['model' => $providerModelEntity->getModelId(), 'model_type' => $modelType?->value]);
            return null;
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

        return $this->createModelByProvider($providerDataIsolation, $providerModelEntity, $providerConfigEntity, $providerEntity);
    }

    private function createProxy(string $model, ModelOptions $modelOptions, ApiOptions $apiOptions): MagicAILocalModel
    {
        // 使用ModelFactory创建模型实例
        $odinModel = ModelFactory::create(
            MagicAILocalModel::class,
            $model,
            [
                'vector_size' => $modelOptions->getVectorSize(),
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
}
