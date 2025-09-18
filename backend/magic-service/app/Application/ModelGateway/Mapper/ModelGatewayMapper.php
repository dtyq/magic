<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Mapper;

use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Entity\ImageGenerationModelWrapper;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Infrastructure\Core\Contract\Model\RerankInterface;
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

    public function __construct(protected ConfigInterface $config, LoggerFactory $loggerFactory)
    {
        $logger = $loggerFactory->get('ModelGatewayMapper');
        $this->models['chat'] = [];
        $this->models['embedding'] = [];
        parent::__construct($config, $logger);

        // 这里具有优先级的顺序来覆盖配置,后续统一迁移到管理后台
        $this->loadEnvModels();
        //        $this->loadFlowModels();
        //        $this->loadApiModels();
    }

    public function exists(string $model, ?string $orgCode = null): bool
    {
        if (isset($this->models['chat'][$model]) || isset($this->models['embedding'][$model])) {
            return true;
        }
        return (bool) $this->getByAdmin($model, $orgCode);
    }

    /**
     * 内部使用 chat 时，一定是使用该方法.
     * 会自动替代为本地代理模型.
     */
    public function getChatModelProxy(string $model, ?string $orgCode = null): MagicAILocalModel
    {
        $odinModel = $this->getOrganizationChatModel($model, $orgCode);
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
    public function getEmbeddingModelProxy(string $model, ?string $orgCode = null): MagicAILocalModel
    {
        /** @var AbstractModel $odinModel */
        $odinModel = $this->getOrganizationEmbeddingModel($model, $orgCode);
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
    public function getOrganizationChatModel(string $model, ?string $orgCode = null, ?ModelFilter $filter = null): ModelInterface|OdinModel
    {
        $odinModel = $this->getByAdmin($model, $orgCode, $filter);
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
    public function getOrganizationEmbeddingModel(string $model, ?string $orgCode = null, ?ModelFilter $filter = null): EmbeddingInterface|OdinModel
    {
        $odinModel = $this->getByAdmin($model, $orgCode, $filter);
        if ($odinModel) {
            return $odinModel;
        }
        return $this->getEmbeddingModel($model);
    }

    public function getOrganizationImageModel(string $model, ?string $orgCode = null, ?ModelFilter $filter = null): ?ImageModel
    {
        $result = $this->getByAdmin($model, $orgCode, $filter, Category::VLM);

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
    public function getChatModels(string $organizationCode, ?ModelFilter $filter = null): array
    {
        return $this->getModelsByType($organizationCode, 'chat', ModelType::LLM, $filter);
    }

    /**
     * 获取当前组织下的所有可用 embedding 模型.
     * @return OdinModel[]
     */
    public function getEmbeddingModels(string $organizationCode, ?ModelFilter $filter = null): array
    {
        return $this->getModelsByType($organizationCode, 'embedding', ModelType::EMBEDDING, $filter);
    }

    /**
     * get all available image models under the current organization.
     * @return OdinModel[]
     */
    public function getImageModels(string $organizationCode = ''): array
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
                createdAt: $model->getCreatedAt(),
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
     * @param string $organizationCode 组织代码
     * @param string $type 模型类型(chat|embedding)
     * @return OdinModel[]
     */
    private function getModelsByType(string $organizationCode, string $type, ?ModelType $modelType = null, ?ModelFilter $filter = null): array
    {
        $list = [];

        // 获取已持久化的配置
        $models = $this->getModels($type);
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

        if (! $filter) {
            $filter = new ModelFilter();
            $filter->setCurrentPackage(di(PackageFilterInterface::class)->getCurrentPackage($organizationCode));
        }

        // 加载 provider 配置的所有模型
        $providerDataIsolation = ProviderDataIsolation::create($organizationCode);
        $allModels = di(ProviderModelRepositoryInterface::class)->getModelsForOrganization($providerDataIsolation, Category::LLM);

        // 按模型类型过滤（如果指定了类型）
        $providerModelData = [];
        foreach ($allModels as $model) {
            if ($modelType && $model->getModelType() !== $modelType) {
                continue;
            }
            if (! $model->getStatus()?->isEnabled()) {
                continue;
            }
            $providerModelData[] = $model;
        }

        $providerConfigIds = [];
        foreach ($providerModelData as $providerModel) {
            $providerConfigIds[] = $providerModel->getServiceProviderConfigId();
        }
        $providerConfigIds = array_unique($providerConfigIds);

        // 获取 服务商 配置
        $providerConfigs = di(ProviderConfigDomainService::class)->getConfigByIdsWithoutOrganizationFilter($providerConfigIds);
        $providerIds = [];
        foreach ($providerConfigs as $providerConfig) {
            $providerIds[] = $providerConfig->getServiceProviderId();
        }
        $providerDataIsolation = ProviderDataIsolation::create($organizationCode);
        // 获取 服务商
        $providers = di(ProviderConfigDomainService::class)->getProviderByIds($providerDataIsolation, $providerIds);

        // 组装数据
        foreach ($providerModelData as $providerModel) {
            if (! $providerConfig = $providerConfigs[$providerModel->getServiceProviderConfigId()] ?? null) {
                continue;
            }
            if (! $providerConfig->getStatus()->isEnabled()) {
                continue;
            }
            if (! $provider = $providers[$providerConfig->getServiceProviderId()] ?? null) {
                continue;
            }

            // 创建配置
            $model = $this->createModelByProvider($providerDataIsolation, $providerModel, $providerConfig, $provider, $filter);
            if (! $model) {
                continue;
            }
            $list[$model->getAttributes()->getKey()] = $model;
        }

        return $list;
    }

    private function createModelByProvider(
        ProviderDataIsolation $providerDataIsolation,
        ProviderModelEntity $providerModelEntity,
        ProviderConfigEntity $providerConfigEntity,
        ProviderEntity $providerEntity,
        ModelFilter $filter
    ): null|ImageModel|OdinModel {
        $checkVisibleApplication = $filter->isCheckVisibleApplication() ?? true;
        $checkVisiblePackage = $filter->isCheckVisiblePackage() ?? true;

        // 如果是官方组织的数据隔离，则不需要检查可见性
        if ($providerDataIsolation->isOfficialOrganization()) {
            $checkVisibleApplication = false;
            $checkVisiblePackage = false;
        }

        // 套餐、应用，采用或的关系
        $hasVisibleApplications = $checkVisibleApplication && $providerModelEntity->getVisibleApplications();
        $hasVisiblePackages = $checkVisiblePackage && $providerModelEntity->getVisiblePackages();

        // 如果配置了可见性检查，使用或的关系判断
        if ($hasVisibleApplications || $hasVisiblePackages) {
            $applicationMatched = false;
            $packageMatched = false;

            // 检查应用可见性（只有配置了才检查）
            if ($hasVisibleApplications) {
                $applicationMatched = in_array($filter->getAppId(), $providerModelEntity->getVisibleApplications(), true);
            }

            // 检查套餐可见性（只有配置了才检查）
            if ($hasVisiblePackages) {
                $packageMatched = in_array($filter->getCurrentPackage(), $providerModelEntity->getVisiblePackages(), true);
            }

            // 只要满足其中一个已配置的条件即可通过
            $shouldAllow = false;
            if ($hasVisibleApplications && $hasVisiblePackages) {
                // 两个都配置了，满足任意一个即可
                $shouldAllow = $applicationMatched || $packageMatched;
            } elseif ($hasVisibleApplications) {
                // 只配置了应用可见性
                $shouldAllow = $applicationMatched;
            } elseif ($hasVisiblePackages) {
                // 只配置了套餐可见性
                $shouldAllow = $packageMatched;
            }

            if (! $shouldAllow) {
                return null;
            }
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

    private function getByAdmin(string $model, ?string $orgCode = null, ?ModelFilter $filter = null, Category $category = Category::LLM): null|ImageModel|OdinModel
    {
        if (! $filter) {
            $filter = new ModelFilter();
            $filter->setCurrentPackage(di(PackageFilterInterface::class)->getCurrentPackage($orgCode ?? ''));
        }

        $providerDataIsolation = ProviderDataIsolation::create($orgCode ?? '');
        $providerDataIsolation->setContainOfficialOrganization(true);
        if (is_null($orgCode)) {
            $providerDataIsolation->disabled();
        }

        // 直接调用仓储层获取所有可用模型（已包含套餐可见性过滤）
        $modelsForOrganization = di(ProviderModelRepositoryInterface::class)->getModelsForOrganization($providerDataIsolation, $category);

        // 在可用模型中查找指定模型
        $providerModelEntity = null;
        foreach ($modelsForOrganization as $availableModel) {
            if ($availableModel->getModelId() === $model || (string) $availableModel->getId() === $model) {
                $providerModelEntity = $availableModel;
                break;
            }
        }

        if (! $providerModelEntity) {
            return null;
        }

        if (! $providerModelEntity->getStatus()?->isEnabled()) {
            return null;
        }

        $providerConfigEntity = di(ProviderConfigDomainService::class)->getConfigByIdWithoutOrganizationFilter($providerModelEntity->getServiceProviderConfigId());
        if (! $providerConfigEntity) {
            return null;
        }

        if (! $providerConfigEntity->getStatus()->isEnabled()) {
            return null;
        }

        $providerEntity = di(ProviderConfigDomainService::class)->getProviderById($providerDataIsolation, $providerConfigEntity->getServiceProviderId());
        if (! $providerEntity) {
            return null;
        }

        return $this->createModelByProvider($providerDataIsolation, $providerModelEntity, $providerConfigEntity, $providerEntity, $filter);
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
