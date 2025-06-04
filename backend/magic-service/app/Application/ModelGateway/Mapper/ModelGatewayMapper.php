<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Mapper;

use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowAIModelQuery;
use App\Domain\Flow\Service\MagicFlowAIModelDomainService;
use App\Domain\ModelAdmin\Constant\ServiceProviderCategory;
use App\Domain\ModelAdmin\Service\ServiceProviderDomainService;
use App\Domain\ModelGateway\Service\ModelConfigDomainService;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderModelQuery;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Core\Contract\Model\RerankInterface;
use App\Infrastructure\Core\Model\ImageGenerationModel;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\ExternalAPI\MagicAIApi\MagicAILocalModel;
use DateTime;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Odin\Api\RequestOptions\ApiOptions;
use Hyperf\Odin\Contract\Model\EmbeddingInterface;
use Hyperf\Odin\Contract\Model\ModelInterface;
use Hyperf\Odin\Factory\ModelFactory;
use Hyperf\Odin\Model\AbstractModel;
use Hyperf\Odin\Model\ModelOptions;
use Hyperf\Odin\ModelMapper;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
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

    public function __construct(protected ConfigInterface $config, protected LoggerInterface $logger)
    {
        $this->models['chat'] = [];
        $this->models['embedding'] = [];
        parent::__construct($config, $logger);

        // 这里具有优先级的顺序来覆盖配置,后续统一迁移到管理后台
        $this->loadEnvModels();
        $this->loadFlowModels();
        $this->loadApiModels();
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
        // 转换为代理
        return $this->createProxy($model, $odinModel->getModelOptions(), $odinModel->getApiRequestOptions());
    }

    /**
     * 该方法获取到的一定是真实调用的模型.
     * 仅 ModelGateway 领域使用.
     * @param string $model 预期是管理后台的 model_id，过度阶段接受传入 model_version
     */
    public function getOrganizationChatModel(string $model, ?string $orgCode = null): ModelInterface|OdinModel
    {
        // 优先从管理后台获取模型配置
        $odinModel = $this->getByAdmin($model, $orgCode);
        if ($odinModel) {
            return $odinModel;
        }
        // 最后一次尝试，从被预加载的模型中获取。注意，被预加载的模型是即将被废弃，后续需要迁移到管理后台
        return $this->getChatModel($model);
    }

    /**
     * 该方法获取到的一定是真实调用的模型.
     * 仅 ModelGateway 领域使用.
     * @param string $model 模型名称 预期是管理后台的 model_id，过度阶段接受 model_version
     */
    public function getOrganizationEmbeddingModel(string $model, ?string $orgCode = null): EmbeddingInterface
    {
        $odinModel = $this->getByAdmin($model, $orgCode);
        if ($odinModel) {
            return $odinModel->getModel();
        }
        return $this->getEmbeddingModel($model);
    }

    /**
     * 获取当前组织下的所有可用 chat 模型.
     * @return OdinModel[]
     */
    public function getChatModels(string $organizationCode): array
    {
        return $this->getModelsByType($organizationCode, 'chat', ModelType::LLM);
    }

    /**
     * 获取当前组织下的所有可用 embedding 模型.
     * @return OdinModel[]
     */
    public function getEmbeddingModels(string $organizationCode): array
    {
        return $this->getModelsByType($organizationCode, 'embedding', ModelType::EMBEDDING);
    }

    /**
     * get all available image models under the current organization.
     * @return OdinModel[]
     */
    public function getImageModels(string $organizationCode = ''): array
    {
        $serviceProviderDomainService = di(ServiceProviderDomainService::class);
        $officeModels = $serviceProviderDomainService->getOfficeModels(ServiceProviderCategory::VLM);

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
                createdAt: new DateTime($model->getCreatedAt()),
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

    protected function loadFlowModels(): void
    {
        $query = new MagicFlowAIModelQuery();
        $query->setEnabled(true);
        $page = Page::createNoPage();
        $dataIsolation = FlowDataIsolation::create()->disabled();
        $list = di(MagicFlowAIModelDomainService::class)->queries($dataIsolation, $query, $page)['list'];
        foreach ($list as $modelEntity) {
            $key = $modelEntity->getName();
            $model = $modelEntity->getModelName() ?: $modelEntity->getName();

            try {
                $this->addModel($key, [
                    'model' => $model,
                    'implementation' => $modelEntity->getImplementation(),
                    'config' => $modelEntity->getActualImplementationConfig(),
                    'model_options' => [
                        'chat' => ! $modelEntity->isSupportEmbedding(),
                        'function_call' => true,
                        'embedding' => $modelEntity->isSupportEmbedding(),
                        'multi_modal' => $modelEntity->isSupportMultiModal(),
                        'vector_size' => $modelEntity->getVectorSize(),
                    ],
                ]);
                $this->addAttributes(
                    key: $key,
                    attributes: new OdinModelAttributes(
                        key: $key,
                        name: $model,
                        label: $modelEntity->getLabel(),
                        icon: $modelEntity->getIcon(),
                        tags: $modelEntity->getTags(),
                        createdAt: $modelEntity->getCreatedAt(),
                        owner: 'MagicAI',
                    )
                );

                $this->logger->info('FlowModelRegister', [
                    'key' => $key,
                    'model_name' => $model,
                    'name' => $modelEntity->getName(),
                    'label' => $modelEntity->getLabel(),
                    'implementation' => $modelEntity->getImplementation(),
                    'display' => $modelEntity->isDisplay(),
                ]);
            } catch (Throwable $exception) {
                $this->logger->warning('FlowModelRegisterWarning', [
                    'key' => $key,
                    'model_name' => $model,
                    'name' => $modelEntity->getName(),
                    'label' => $modelEntity->getLabel(),
                    'implementation' => $modelEntity->getImplementation(),
                    'display' => $modelEntity->isDisplay(),
                    'error' => $exception->getMessage(),
                ]);
            }
        }
    }

    protected function loadApiModels(): void
    {
        $modelConfigs = di(ModelConfigDomainService::class)->getByModels(['all']);
        foreach ($modelConfigs as $modelConfig) {
            // 如果 enabled 为 false，则跳过
            if (! $modelConfig->isEnabled()) {
                continue;
            }

            $key = $modelConfig->getModel();
            $modelEndpointId = $modelConfig->getModel();
            $embedding = str_contains($modelEndpointId, 'embedding');
            $modelOptions = new ModelOptions([
                'chat' => ! $embedding,
                'function_call' => true,
                'embedding' => $embedding,
                'multi_modal' => false,
                'vector_size' => 0,
            ]);

            $latestModel = null;
            $lasestAttribute = null;
            /** @var AbstractModel $historyModel */
            foreach ($this->getModels($embedding ? 'embedding' : 'chat') as $historyKey => $historyModel) {
                if ($historyModel->getModelName() === $modelEndpointId && $historyModel instanceof MagicAILocalModel) {
                    $modelOptions = $historyModel->getModelOptions();
                    $latestModel = $historyModel;
                    $lasestAttribute = $this->attributes[$historyKey];
                    break;
                }
            }

            if ($latestModel && $lasestAttribute) {
                $attribute = $lasestAttribute;
            } else {
                $attribute = new OdinModelAttributes(
                    key: $key,
                    name: $modelConfig->getType() ?: $modelConfig->getModel(),
                    label: $modelConfig->getName() ?: $modelConfig->getModel(),
                    icon: $lasestAttribute?->getIcon() ?: '',
                    tags: [['type' => 1, 'value' => 'MagicAI']],
                    createdAt: $modelConfig->getCreatedAt(),
                    owner: 'MagicAI',
                );
            }

            try {
                $this->addModel($key, [
                    'model' => $modelEndpointId,
                    'implementation' => $modelConfig->getImplementation(),
                    'config' => $modelConfig->getActualImplementationConfig(),
                    'model_options' => $modelOptions->toArray(),
                ]);

                $this->addAttributes($key, $attribute);
                $this->logger->info('ApiModelRegister', [
                    'key' => $key,
                    'model' => $modelEndpointId,
                    'label' => $attribute->getLabel(),
                    'implementation' => $modelConfig->getImplementation(),
                ]);
            } catch (Throwable $exception) {
                $this->logger->warning('ApiModelRegisterWarning', [
                    'key' => $key,
                    'model' => $modelEndpointId,
                    'label' => $attribute->getLabel(),
                    'implementation' => $modelConfig->getImplementation(),
                    'error' => $exception->getMessage(),
                ]);
            }
        }
    }

    /**
     * 获取当前组织下指定类型的所有可用模型.
     * @param string $organizationCode 组织代码
     * @param string $type 模型类型(chat|embedding)
     * @return OdinModel[]
     */
    private function getModelsByType(string $organizationCode, string $type, ?ModelType $modelType = null): array
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

        // 加载 provider 配置的所有模型
        $providerDataIsolation = ProviderDataIsolation::create($organizationCode);
        $providerModelQuery = new ProviderModelQuery();
        $providerModelQuery->setStatus(Status::Enabled);
        $providerModelQuery->setCategory(Category::LLM);
        $providerModelQuery->setModelType($modelType);
        $providerModelData = di(ProviderModelDomainService::class)->queries($providerDataIsolation, $providerModelQuery, Page::createNoPage());
        $providerConfigIds = [];
        foreach ($providerModelData['list'] as $providerModel) {
            $providerConfigIds[] = $providerModel->getProviderConfigId();
        }
        $providerConfigIds = array_unique($providerConfigIds);

        // 获取 服务商 配置
        $providerConfigs = di(ProviderConfigDomainService::class)->getByIds($providerDataIsolation, $providerConfigIds);
        $providerIds = [];
        foreach ($providerConfigs as $providerConfig) {
            $providerIds[] = $providerConfig->getProviderId();
        }

        // 获取 服务商
        $providers = di(ProviderDomainService::class)->getByIds($providerDataIsolation, $providerIds);

        // 组装数据
        foreach ($providerModelData['list'] as $providerModel) {
            if (! $providerModel->getStatus()->isEnabled()) {
                continue;
            }
            if (! $providerConfig = $providerConfigs[$providerModel->getProviderConfigId()] ?? null) {
                continue;
            }
            if (! $providerConfig->getStatus()->isEnabled()) {
                continue;
            }
            if (! $provider = $providers[$providerConfig->getProviderId()] ?? null) {
                continue;
            }

            // 创建配置
            $model = $this->createModelByProvider($organizationCode, $providerModel, $providerConfig, $provider);
            if (! $model) {
                continue;
            }
            $list[$model->getAttributes()->getKey()] = $model;
        }

        return $list;
    }

    private function createModelByProvider(string $organizationCode, ProviderModelEntity $providerModelEntity, ProviderConfigEntity $providerConfigEntity, ProviderEntity $providerEntity): ?OdinModel
    {
        if ($providerModelEntity->getVisibleOrganizations() && ! in_array($organizationCode, $providerModelEntity->getVisibleOrganizations())) {
            return null;
        }
        $chat = false;
        $functionCall = false;
        $multiModal = false;
        $embedding = false;
        $vectorSize = 0;
        if ($providerModelEntity->getModelType()->isLLM()) {
            $chat = true;
            $functionCall = $providerModelEntity->getConfig()->isSupportFunction();
            $multiModal = $providerModelEntity->getConfig()->isSupportMultiModal();
        } elseif ($providerModelEntity->getModelType()->isEmbedding()) {
            $embedding = true;
            $vectorSize = $providerModelEntity->getConfig()->getVectorSize();
        }

        $key = $providerModelEntity->getModelId();

        $implementation = $providerEntity->getProviderCode()->getImplementation();
        $implementationConfig = $providerEntity->getProviderCode()->getImplementationConfig($providerConfigEntity->getConfig(), $providerModelEntity->getModelVersion());

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
                icon: $providerModelEntity->getIcon(),
                tags: [['type' => 1, 'value' => $providerEntity->getProviderCode()->value]],
                createdAt: $providerEntity->getCreatedAt(),
                owner: 'MagicAI',
                providerAlias: $providerConfigEntity->getAlias() ?? $providerEntity->getName(),
                providerModelId: (string) $providerModelEntity->getId(),
            )
        );
    }

    private function getByAdmin(string $model, ?string $orgCode = null): ?OdinModel
    {
        $providerDataIsolation = ProviderDataIsolation::create($orgCode ?? '');
        $providerDataIsolation->setContainOfficialOrganization(true);
        if (is_null($orgCode)) {
            $providerDataIsolation->disabled();
        }
        $providerModel = di(ProviderModelDomainService::class)->getByIdOrModelId($providerDataIsolation, $model);

        if (! $providerModel || ! $providerModel->getStatus()->isEnabled()) {
            return null;
        }
        if (! in_array($providerModel->getOrganizationCode(), $providerDataIsolation->getOfficialOrganizationCodes())) {
            if ($providerModel->getModelParentId() && $providerModel->getId() !== $providerModel->getModelParentId()) {
                $providerModel = di(ProviderModelDomainService::class)->getById($providerDataIsolation, $providerModel->getModelParentId());
                if (! $providerModel || ! $providerModel->getStatus()->isEnabled()) {
                    return null;
                }
            }
        }

        $providerConfig = di(ProviderConfigDomainService::class)->getById($providerDataIsolation, $providerModel->getProviderConfigId());
        if (! $providerConfig || ! $providerConfig->getStatus()->isEnabled()) {
            return null;
        }

        $provider = di(ProviderDomainService::class)->getById($providerDataIsolation, $providerConfig->getProviderId());
        if (! $provider) {
            return null;
        }

        return $this->createModelByProvider($orgCode, $providerModel, $providerConfig, $provider);
    }

    private function addAttributes(string $key, OdinModelAttributes $attributes): void
    {
        $this->attributes[$key] = $attributes;
    }

    private function createModel(string $model, array $item): EmbeddingInterface|ModelInterface
    {
        $implementation = $item['implementation'] ?? '';
        if (! class_exists($implementation)) {
            throw new InvalidArgumentException(sprintf('Implementation %s is not defined.', $implementation));
        }

        // 获取全局模型配置和API配置
        $generalModelOptions = $this->config->get('odin.llm.general_model_options', []);
        $generalApiOptions = $this->config->get('odin.llm.general_api_options', []);

        // 全局配置可以被模型配置覆盖
        $modelOptionsArray = array_merge($generalModelOptions, $item['model_options'] ?? []);
        $apiOptionsArray = array_merge($generalApiOptions, $item['api_options'] ?? []);

        // 创建选项对象
        $modelOptions = new ModelOptions($modelOptionsArray);
        $apiOptions = new ApiOptions($apiOptionsArray);

        // 获取配置
        $config = $item['config'] ?? [];

        // 获取实际的端点名称，优先使用模型配置中的model字段
        $endpoint = empty($item['model']) ? $model : $item['model'];

        // 使用ModelFactory创建模型实例
        return ModelFactory::create(
            $implementation,
            $endpoint,
            $config,
            $modelOptions,
            $apiOptions,
            $this->logger
        );
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
