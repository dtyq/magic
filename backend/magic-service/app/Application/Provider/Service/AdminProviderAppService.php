<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Service;

use App\Application\Kernel\EnvManager;
use App\Application\Kernel\SmartFileLinks;
use App\Application\ModelGateway\Service\LLMAppService;
use App\Application\Provider\Policy\ProviderControlPolicyInterface;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use App\Domain\ModelGateway\Entity\Dto\EmbeddingsDTO;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\Provider\DTO\ProviderConfigDTO;
use App\Domain\Provider\DTO\ProviderConfigModelsDTO;
use App\Domain\Provider\DTO\ProviderModelDetailDTO;
use App\Domain\Provider\DTO\ProviderModelItemDTO;
use App\Domain\Provider\Entity\ProviderEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\NaturalLanguageProcessing;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderModelQuery;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Event\ProviderConfigCreatedEvent;
use App\Domain\Provider\Event\ProviderConfigUpdatedEvent;
use App\Domain\Provider\Event\ProviderModelCreatedEvent;
use App\Domain\Provider\Event\ProviderModelDeletedEvent;
use App\Domain\Provider\Event\ProviderModelUpdatedEvent;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\Domain\Provider\Service\ConnectivityTest\ConnectResponse;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Util\FuzzMatchUtil;
use App\Infrastructure\Util\Redis\ProviderModelCacheUtil;
use App\Interfaces\Agent\Assembler\FileAssembler;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Provider\Assembler\ProviderAdminAssembler;
use App\Interfaces\Provider\DTO\SaveProviderConfigRequest;
use App\Interfaces\Provider\DTO\SaveProviderModelDTO;
use Exception;
use Hyperf\DbConnection\Db;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use JsonException;
use Psr\EventDispatcher\EventDispatcherInterface;

use function Hyperf\Translation\__;

readonly class AdminProviderAppService
{
    use HasLogger;

    public function __construct(
        private ProviderConfigDomainService $providerConfigDomainService,
        private FileDomainService $fileDomainService,
        private ProviderModelDomainService $providerModelDomainService,
        private AdminProviderDomainService $adminProviderDomainService,
        private EventDispatcherInterface $eventDispatcher,
        private ProviderControlPolicyInterface $providerControlPolicy,
    ) {
    }

    /**
     * 根据服务商配置ID获取服务商详细信息.
     */
    public function getProviderModelsByConfigId(
        MagicUserAuthorization $authorization,
        string $configId
    ): ?ProviderConfigModelsDTO {
        // 构建数据隔离对象
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );

        // 通过领域层方法一次性获取服务商、配置和模型信息
        $providerModels = $this->providerConfigDomainService->getProviderModelsByConfigId($dataIsolation, $configId);
        if ($providerModels === null) {
            return null;
        }

        // ProviderModelsDTO 已经包含所有需要的数据，统一处理 provider 和 models 的 icon 并返回
        $this->processProviderAndModelsIcons($providerModels);

        return $providerModels;
    }

    /**
     * 创建、更新服务商配置统一入口。
     *
     * 通过请求里的 id 判断是创建还是更新，并统一处理服务商解析、白名单校验、
     * URL 一级域名校验和最终落库逻辑。
     */
    public function saveProviderConfig(
        MagicUserAuthorization $authorization,
        SaveProviderConfigRequest $saveProviderConfigRequest,
    ): ProviderConfigModelsDTO {
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );

        $isUpdate = $saveProviderConfigRequest->getId() !== '';
        $existingConfigEntity = null;
        $serviceProviderId = $saveProviderConfigRequest->getServiceProviderId();

        // 更新时，获取现有配置实体
        if ($isUpdate) {
            $existingConfigEntity = $this->providerConfigDomainService->getConfigByIdWithoutOrganizationFilter((int) $saveProviderConfigRequest->getId());
            if ($existingConfigEntity === null) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotFound);
            }
            $serviceProviderId ??= (string) $existingConfigEntity->getServiceProviderId();
        }

        // 获取服务商实体
        $providerEntity = $this->providerConfigDomainService->getProviderById($dataIsolation, (int) $serviceProviderId);
        if ($providerEntity === null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotFound);
        }

        // 根据 Provider Control Policy 预处理保存配置，统一收口准入校验与 URL 规则。
        $saveProviderConfigRequest->setConfig($this->providerControlPolicy->prepareProviderConfigForSave(
            $authorization->getOrganizationCode(),
            $providerEntity->getProviderCode(),
            $providerEntity->getCategory(),
            $saveProviderConfigRequest->getConfig(),
        ));

        // 组装服务商配置实体
        $providerConfigEntity = ProviderAdminAssembler::requestToEntity(
            $saveProviderConfigRequest,
            $providerEntity->getProviderCode(),
            $authorization->getOrganizationCode(),
            $providerEntity->getId(),
        );

        // 更新时，更新服务商配置
        if ($isUpdate) {
            if ($existingConfigEntity !== null && is_null($saveProviderConfigRequest->getStatus())) {
                $providerConfigEntity->setStatus($existingConfigEntity->getStatus());
            }

            $providerConfigEntity = $this->providerConfigDomainService->updateProviderConfig($dataIsolation, $providerConfigEntity);
            $this->eventDispatcher->dispatch(new ProviderConfigUpdatedEvent(
                $providerConfigEntity,
                $authorization->getOrganizationCode(),
                $dataIsolation->getLanguage()
            ));

            return ProviderAdminAssembler::entityToModelsDTO($providerConfigEntity);
        }

        // 创建时，创建服务商配置
        $providerConfigEntity = $this->providerConfigDomainService->createProviderConfig($dataIsolation, $providerConfigEntity);
        $this->eventDispatcher->dispatch(new ProviderConfigCreatedEvent(
            $providerConfigEntity,
            $authorization->getOrganizationCode(),
            $dataIsolation->getLanguage()
        ));

        $providerModelsDTO = ProviderAdminAssembler::entityToModelsDTO($providerConfigEntity);
        $providerModelsDTO->setId((string) $providerConfigEntity->getId());

        $this->fillProviderInfoAndIcon($providerEntity, $providerModelsDTO);
        return $providerModelsDTO;
    }

    // 删除服务商
    /**
     * @throws Exception
     */
    public function deleteProvider(
        MagicUserAuthorization $authorization,
        string $id,
    ): void {
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );

        // 事务
        Db::beginTransaction();

        try {
            if ($this->isOfficialOrganization($authorization->getOrganizationCode())) {
                $providerModelEntities = $this->providerModelDomainService->getByProviderConfigId($dataIsolation, $id);
                $modelParentIds = array_column($providerModelEntities, 'id');
                $cloneDataIsolation = clone $dataIsolation;
                $cloneDataIsolation->disabled();
                $this->providerModelDomainService->deleteByModelParentIds($cloneDataIsolation, $modelParentIds);
            }

            $this->providerConfigDomainService->delete($dataIsolation, $id);
            $this->providerModelDomainService->deleteByProviderId($dataIsolation, $id);
            Db::commit();
        } catch (Exception $e) {
            Db::rollBack();
            throw $e;
        }
    }

    // 删除模型

    /**
     * @throws Exception
     */
    public function deleteModel(
        MagicUserAuthorization $authorization,
        string $id,
    ): void {
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );

        // 获取模型信息，用于触发事件
        $modelEntity = $this->providerModelDomainService->getById($dataIsolation, $id);

        Db::beginTransaction();
        try {
            if ($this->isOfficialOrganization($authorization->getOrganizationCode())) {
                $cloneDataIsolation = clone $dataIsolation;
                $cloneDataIsolation->disabled();
                $this->providerModelDomainService->deleteByModelParentId($cloneDataIsolation, $id);
            }
            $this->providerModelDomainService->deleteById($dataIsolation, $id);

            // 触发模型删除事件
            $this->eventDispatcher->dispatch(new ProviderModelDeletedEvent(
                $id,
                $modelEntity->getServiceProviderConfigId(),
                $authorization->getOrganizationCode()
            ));

            Db::commit();
        } catch (Exception $e) {
            $this->logger->error('删除模型失败', ['error' => $e->getMessage()]);
            Db::rollBack();
            throw $e;
        }
    }

    /**
     * 修改模型状态.
     */
    public function updateModelStatus(
        MagicUserAuthorization $authorization,
        string $id,
        int $status,
    ): void {
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );

        $statusEnum = Status::from($status);
        $this->providerModelDomainService->updateStatus($dataIsolation, $id, $statusEnum);
    }

    // 保存模型
    public function saveModel(MagicUserAuthorization $authorization, SaveProviderModelDTO $saveProviderModelDTO): array
    {
        $dataIsolation = ProviderDataIsolation::create($authorization->getOrganizationCode(), $authorization->getId());
        $organizationCode = $authorization->getOrganizationCode();

        // 记录是创建还是更新
        $isCreate = ! $saveProviderModelDTO->getId();

        // 如果创建的时候没有传 model_id，则使用 model_version
        if ($isCreate && ! $saveProviderModelDTO->getModelId()) {
            $saveProviderModelDTO->setModelId($saveProviderModelDTO->getModelVersion());
        }

        // 判断是否需要在 model_id 前面需要拼接上组织编码
        if ($saveProviderModelDTO->getModelId()) {
            $providerModelEntity = new ProviderModelEntity();
            $providerModelEntity->setOrganizationCode($organizationCode);
            $saveProviderModelDTO->setModelId($providerModelEntity->processModelIdForSave($saveProviderModelDTO->getModelId()));
        }

        $saveProviderModelDTO = $this->providerModelDomainService->saveModel($dataIsolation, $saveProviderModelDTO);

        // 获取保存后的模型实体
        $modelEntity = $this->providerModelDomainService->getById($dataIsolation, $saveProviderModelDTO->getId());

        // 触发相应的事件
        if ($isCreate) {
            $this->eventDispatcher->dispatch(new ProviderModelCreatedEvent(
                $modelEntity,
                $authorization->getOrganizationCode()
            ));
        } else {
            $this->eventDispatcher->dispatch(new ProviderModelUpdatedEvent(
                $modelEntity,
                $authorization->getOrganizationCode()
            ));
        }

        $saveProviderModelData = $saveProviderModelDTO->toArray();
        // icon传入是 url，返回也需要是 url，但是保存在数据库是 file_key
        // 所以 SaveProviderModelDTO 的 setIcon 做了 url 到 file_key的转换
        $saveProviderModelData['icon'] = $this->getFileUrl($saveProviderModelDTO->getIcon());
        return $saveProviderModelData;
    }

    /**
     * 根据组织编码和服务商分类获取活跃的服务商配置.
     * @param string $organizationCode 组织编码
     * @param Category $category 服务商分类
     * @return ProviderConfigDTO[]
     */
    public function getOrganizationProvidersModelsByCategory(string $organizationCode, Category $category): array
    {
        // 调用领域层时传递 modelTypes 参数，让仓储层完成查询和过滤
        $serviceProviderModelsDTOs = $this->adminProviderDomainService->getOrganizationProvidersModelsByCategory($organizationCode, $category);

        // 处理图标
        $this->processProviderConfigIcons($serviceProviderModelsDTOs);

        return array_values($serviceProviderModelsDTOs);
    }

    /**
     * @throws Exception
     */
    public function connectivityTest(string $modelPrimaryId, MagicUserAuthorization $authorization): ConnectResponse
    {
        // 构建数据隔离对象
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );

        // 通过领域层方法获取完整的模型详情信息
        $providerModelEntity = $this->providerModelDomainService->getById(
            $dataIsolation,
            $modelPrimaryId
        );
        // 根据服务商类型和模型类型进行连通性测试
        return match ($this->getConnectivityTestType($providerModelEntity->getCategory()->value, $providerModelEntity->getModelType()->value)) {
            NaturalLanguageProcessing::EMBEDDING => $this->embeddingConnectivityTest($modelPrimaryId, $authorization),
            NaturalLanguageProcessing::LLM => $this->llmConnectivityTest($modelPrimaryId, $authorization),
            NaturalLanguageProcessing::VLM => $this->adminProviderDomainService->vlmConnectivityTest($modelPrimaryId, $authorization),
            default => throw new BusinessException(__('service_provider.connectivity_not_supported')),
        };
    }

    /**
     * 获取服务商列表，不依赖于组织.
     *
     * @param ?Category $category 服务商分类
     * @param string $organizationCode 组织编码
     * @param bool $isFrontend 是否前台（开放）场景；为 true 且分类为 VLM 时仅返回火山与通义千问模板
     * @return ProviderConfigModelsDTO[] 非官方服务商列表
     */
    public function queriesServiceProviderTemplates(?Category $category, string $organizationCode, bool $isFrontend = false): array
    {
        // 获取所有非官方服务商
        $serviceProviders = $this->adminProviderDomainService->queriesServiceProviderTemplates($organizationCode, $category);

        if (empty($serviceProviders)) {
            return [];
        }

        // 根据 Provider Control Policy 过滤可见的服务商模板。
        $serviceProviders = $this->providerControlPolicy->filterSelectableProviders($organizationCode, $category, $serviceProviders);

        // 前台场景仅返回火山与通义千问模板
        if ($isFrontend && $category === Category::VLM) {
            $frontendVlmWhitelist = [ProviderCode::Volcengine, ProviderCode::Qwen];
            $serviceProviders = array_values(array_filter(
                $serviceProviders,
                static fn (ProviderConfigModelsDTO $serviceProvider): bool => in_array($serviceProvider->getProviderCode(), $frontendVlmWhitelist, true)
            ));
        }

        // 处理图标
        $this->processServiceProviderEntityListIcons($serviceProviders, $organizationCode);

        return $serviceProviders;
    }

    /**
     * 获取所有可用的服务商列表（包括官方服务商），不依赖于组织.
     *
     * @param Category $category 服务商分类
     * @param string $organizationCode 组织编码
     * @return ProviderConfigModelsDTO[] 所有可用服务商列表
     */
    public function getAllAvailableLlmProviders(Category $category, string $organizationCode): array
    {
        // 获取所有服务商（包括Official）
        $serviceProviders = $this->adminProviderDomainService->getAllAvailableProviders($category);

        if (empty($serviceProviders)) {
            return [];
        }

        // 过滤服务商
        $serviceProviders = $this->providerControlPolicy->filterSelectableProviders($organizationCode, $category, $serviceProviders);

        // 处理图标
        $this->processServiceProviderEntityListIcons($serviceProviders, $organizationCode);

        return $serviceProviders;
    }

    /**
     * 获取官方组织下的所有可用模型.
     * @return ProviderModelDetailDTO[]
     */
    public function queriesModels(MagicUserAuthorization $authorization, ProviderModelQuery $providerModelQuery): array
    {
        $organizationCode = $authorization->getOrganizationCode();
        $userId = $authorization->getId();

        // Try to get from cache
        $cachedData = ProviderModelCacheUtil::getProviderModels($organizationCode, $userId, $providerModelQuery);
        if ($cachedData !== false) {
            // Convert cached data back to ProviderModelDetailDTO objects
            $providerConfigModelsDTOs = [];
            foreach ($cachedData as $modelData) {
                $providerConfigModelsDTOs[] = new ProviderModelDetailDTO($modelData);
            }
            return $providerConfigModelsDTOs;
        }

        // Cache miss, query from database
        $dataIsolation = ProviderDataIsolation::create($organizationCode, $userId);
        $queriesModels = $this->adminProviderDomainService->queriesModels($dataIsolation, $providerModelQuery);
        $providerConfigModelsDTOs = [];
        foreach ($queriesModels as $model) {
            $providerConfigModelsDTOs[] = new ProviderModelDetailDTO($model->toArray());
        }

        $this->processModelIcons($providerConfigModelsDTOs);

        // Cache the result
        $cacheData = array_map(static fn ($dto) => $dto->toArray(), $providerConfigModelsDTOs);
        ProviderModelCacheUtil::setProviderModels($organizationCode, $userId, $providerModelQuery, $cacheData);

        return $providerConfigModelsDTOs;
    }

    /**
     * 获取模型详情.
     */
    public function getModelDetail(MagicUserAuthorization $authorization, string $modelId): ProviderModelDetailDTO
    {
        $dataIsolation = ProviderDataIsolation::create($authorization->getOrganizationCode(), $authorization->getId());

        // 获取模型实体
        $modelEntity = $this->providerModelDomainService->getById($dataIsolation, $modelId);
        // 转换为 DTO
        $modelArray = $modelEntity->toArray();
        // 返回时使用过滤后的 modelId（去掉组织编码前缀）
        $modelArray['model_id'] = $modelEntity->getDisplayModelId();

        $modelDetailDTO = new ProviderModelDetailDTO($modelArray);

        // 处理图标
        $this->processModelIcons([$modelDetailDTO]);

        return $modelDetailDTO;
    }

    /**
     * 初始化Magic服务商配置数据.
     */
    public function initializeMagicProviderConfigs(): int
    {
        return $this->adminProviderDomainService->initializeMagicProviderConfigs();
    }

    /**
     * 获取活跃的模型列表.
     * @param ?Category $category 模型分类（可选）
     * @param ModelType[] $modelTypes 模型类型数组（可选）
     * @return ProviderModelItemDTO[] 模型列表
     */
    public function getAvailableModelsForOrganization(MagicUserAuthorization $authorization, ?Category $category = null, array $modelTypes = []): array
    {
        $ModelGatewayDataIsolation = new ModelGatewayDataIsolation($authorization->getOrganizationCode(), $authorization->getId(), $authorization->getMagicId());

        // 构建数据隔离对象
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );

        // 从领域层获取启用的模型
        $models = $this->providerModelDomainService->getEnableModels($dataIsolation, $category, $modelTypes);

        if (empty($models)) {
            return [];
        }

        EnvManager::initDataIsolationEnv($ModelGatewayDataIsolation, force: true);
        $availableModelIds = $ModelGatewayDataIsolation->getSubscriptionManager()->getAvailableModelIds(null);

        // 转换为DTO并处理图标
        $providerModelItemDTOs = [];
        foreach ($models as $model) {
            // 无效的则过滤
            if (! is_null($availableModelIds) && ! in_array($model->getModelId(), $availableModelIds)) {
                continue;
            }
            if (isset($providerModelItemDTOs[$model->getModelId()])) {
                continue;
            }

            $providerModelItemDTO = new ProviderModelItemDTO([
                'id' => (string) $model->getId(),
                'name' => $model->getName(),
                'model_id' => $model->getModelId(),
                'model_type' => $model->getModelType()->value,
                'category' => $model->getCategory()->value,
                'icon' => $model->getIcon(),
                'description' => $model->getDescription(),
            ]);
            $providerModelItemDTOs[$model->getModelId()] = $providerModelItemDTO;
        }

        // 按照 name 进行排序
        $sortedModels = array_values($providerModelItemDTOs);
        usort($sortedModels, static function ($a, $b) {
            return strcmp($a->getName(), $b->getName());
        });
        $this->processModelIcons($sortedModels);

        return $sortedModels;
    }

    /**
     * 根据名称匹配模型.
     * @param string $name 模型名称
     * @param int $minScore 最低相似度阈值，默认 30
     * @return null|array 返回匹配到的模型记录，如果没有匹配到则返回 null
     */
    public function matchModelByName(string $name, int $minScore = 30, int $limit = 10, ?string $category = null): ?array
    {
        if (empty($name)) {
            return null;
        }

        // 读取 JSON 文件并解析成数组
        $jsonFilePath = config('service_provider.llm_model_file', '');
        if (empty($jsonFilePath) || ! file_exists($jsonFilePath)) {
            return null;
        }

        $jsonContent = file_get_contents($jsonFilePath);
        if ($jsonContent === false) {
            return null;
        }

        try {
            $models = json_decode($jsonContent, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return null;
        }

        if (! is_array($models)) {
            return null;
        }

        // 使用 array_column 以 name 作为 key
        $modelsByName = array_column($models, null, 'name');

        if ($category) {
            $modelsByName = array_filter($modelsByName, static function ($model) use ($category) {
                return $model['category'] === $category;
            });
        }

        // 如果没有完全匹配，使用模糊匹配
        // 注意：FuzzMatchUtil::findBestMatchName 第二个参数需要传入以 name 为 key 的数组
        $matchedNames = FuzzMatchUtil::findBestMatchName($name, array_keys($modelsByName), $minScore, $limit);

        if (empty($matchedNames)) {
            return [];
        }

        $modelInfos = [];
        foreach ($matchedNames as $matchedName) {
            if (isset($modelsByName[$matchedName])) {
                $modelInfos[] = $modelsByName[$matchedName];
            }
        }

        return $modelInfos;
    }

    /**
     * @param array<int, ProviderModelDetailDTO|ProviderModelItemDTO> $providerModelDetailDTOs
     */
    private function processModelIcons(array $providerModelDetailDTOs): void
    {
        if (empty($providerModelDetailDTOs)) {
            return;
        }

        $iconToModelMap = [];

        foreach ($providerModelDetailDTOs as $model) {
            $icon = $model->getIcon();
            if (empty($icon)) {
                continue;
            }

            $icon = FileAssembler::formatPath($icon);
            $iconToModelMap[$icon][] = $model;
        }

        if (empty($iconToModelMap)) {
            return;
        }

        // 设置图标URL
        foreach (SmartFileLinks::list(array_keys($iconToModelMap)) as $icon => $fileLink) {
            if (isset($iconToModelMap[$icon])) {
                $url = $fileLink ? $fileLink->getUrl() : '';
                foreach ($iconToModelMap[$icon] as $model) {
                    $model->setIcon($url);
                }
            }
        }
    }

    /**
     * 填充 provider 信息并处理 icon.
     */
    private function fillProviderInfoAndIcon(
        ProviderEntity $provider,
        ProviderConfigModelsDTO $providerModelsDTO
    ): void {
        // 填充 provider 基本信息
        $providerModelsDTO->setName($provider->getName());
        $providerModelsDTO->setDescription($provider->getDescription());
        $providerModelsDTO->setServiceProviderId((string) $provider->getId());
        $providerModelsDTO->setCategory($provider->getCategory()->value);
        $providerModelsDTO->setProviderCode($provider->getProviderCode());
        $providerModelsDTO->setProviderType($provider->getProviderType());
        $providerModelsDTO->setIcon($this->getFileUrl($provider->getIcon()));
    }

    private function getFileUrl(string $icon): string
    {
        if (empty($icon)) {
            return '';
        }
        $icon = FileAssembler::formatPath($icon);

        $organizationCode = $this->extractOrganizationCodeFromIcon($icon);
        if ($organizationCode === null) {
            return '';
        }
        $fileLink = $this->fileDomainService->getLink($organizationCode, $icon);
        return $fileLink !== null ? $fileLink->getUrl() : '';
    }

    /**
     * 统一处理 Provider 和 Models 的图标，转换为完整URL.
     */
    private function processProviderAndModelsIcons(ProviderConfigModelsDTO $providerDTO): void
    {
        // 收集所有图标路径和对应的组织编码
        $iconsByOrg = [];
        $providerIconMap = [];  // provider图标映射
        $modelIconMap = [];     // 模型图标映射

        // 处理 provider 图标
        $providerIcon = $providerDTO->getIcon();
        if (! empty($providerIcon)) {
            $providerIcon = $this->collectIconByOrganization($iconsByOrg, $providerIcon);
            if ($providerIcon !== null) {
                $providerIconMap[$providerIcon] = $providerDTO;
            }
        }

        // 处理模型图标
        $modelEntities = $providerDTO->getModels();
        if (! empty($modelEntities)) {
            foreach ($modelEntities as $modelEntity) {
                $icon = $modelEntity->getIcon();
                if (empty($icon)) {
                    continue;
                }

                $icon = $this->collectIconByOrganization($iconsByOrg, $icon);
                if ($icon === null) {
                    continue;
                }

                // 记录图标到模型的映射关系
                if (! isset($modelIconMap[$icon])) {
                    $modelIconMap[$icon] = [];
                }
                $modelIconMap[$icon][] = $modelEntity;
            }
        }

        // 按组织编码批量获取图标URL
        foreach ($iconsByOrg as $organizationCode => $icons) {
            $iconUrlMap = $this->fileDomainService->getLinks($organizationCode, array_unique($icons));

            // 设置图标URL
            foreach ($iconUrlMap as $icon => $fileLink) {
                $url = $fileLink ? $fileLink->getUrl() : '';

                // 设置 provider 图标URL
                if (isset($providerIconMap[$icon])) {
                    $providerIconMap[$icon]->setIcon($url);
                }

                // 设置模型图标URL
                if (isset($modelIconMap[$icon])) {
                    foreach ($modelIconMap[$icon] as $modelEntity) {
                        $modelEntity->setIcon($url);
                    }
                }
            }
        }
    }

    // 是否是官方组织
    private function isOfficialOrganization(string $organizationCode): bool
    {
        $officialOrganization = config('service_provider.office_organization');
        return $organizationCode === $officialOrganization;
    }

    /**
     * 获取联通测试类型.
     */
    private function getConnectivityTestType(string $category, int $modelType): NaturalLanguageProcessing
    {
        if (Category::from($category) === Category::LLM) {
            return $modelType === ModelType::EMBEDDING->value ? NaturalLanguageProcessing::EMBEDDING : NaturalLanguageProcessing::LLM;
        }
        if (Category::from($category)->isVlm()) {
            return NaturalLanguageProcessing::VLM;
        }
        return NaturalLanguageProcessing::DEFAULT;
    }

    private function embeddingConnectivityTest(string $modelPrimaryId, MagicUserAuthorization $authorization): ConnectResponse
    {
        $connectResponse = new ConnectResponse();
        $llmAppService = di(LLMAppService::class);
        $proxyModelRequest = new EmbeddingsDTO();
        if (defined('MAGIC_ACCESS_TOKEN')) {
            $proxyModelRequest->setAccessToken(MAGIC_ACCESS_TOKEN);
        }
        $proxyModelRequest->setModel($modelPrimaryId);
        $proxyModelRequest->setInput('test');
        $proxyModelRequest->setEnableHighAvailability(false); // 连通性测试时不启用高可用
        $proxyModelRequest->setBusinessParams([
            'organization_id' => $authorization->getOrganizationCode(),
            'user_id' => $authorization->getId(),
            'source_id' => 'connectivity_test',
        ]);
        try {
            $llmAppService->embeddings($proxyModelRequest);
        } catch (Exception $exception) {
            $connectResponse->setStatus(false);
            $connectResponse->setMessage($exception->getMessage());
            return $connectResponse;
        }
        $connectResponse->setStatus(true);
        return $connectResponse;
    }

    private function llmConnectivityTest(string $modelPrimaryId, MagicUserAuthorization $authorization): ConnectResponse
    {
        $connectResponse = new ConnectResponse();
        $llmAppService = di(LLMAppService::class);
        $completionDTO = new CompletionDTO();
        if (defined('MAGIC_ACCESS_TOKEN')) {
            $completionDTO->setAccessToken(MAGIC_ACCESS_TOKEN);
        }
        $completionDTO->setMessages([['role' => 'user', 'content' => '你好']]);
        $completionDTO->setModel($modelPrimaryId);
        $completionDTO->setEnableHighAvailability(false); // 连通性测试时不启用高可用
        $completionDTO->setBusinessParams([
            'organization_id' => $authorization->getOrganizationCode(),
            'user_id' => $authorization->getId(),
            'source_id' => 'connectivity_test',
        ]);
        $completionDTO->setMaxTokens(-1);
        /* @var ChatCompletionResponse $response */
        try {
            $llmAppService->chatCompletion($completionDTO);
        } catch (Exception $exception) {
            $connectResponse->setStatus(false);
            $connectResponse->setMessage($exception->getMessage());
            return $connectResponse;
        }
        $connectResponse->setStatus(true);
        return $connectResponse;
    }

    /**
     * 处理服务提供商实体列表的图标.
     *
     * @param ProviderConfigModelsDTO[] $serviceProviders 服务提供商实体列表
     * @param string $organizationCode 组织编码
     */
    private function processServiceProviderEntityListIcons(array $serviceProviders, string $organizationCode): void
    {
        // 收集所有图标
        $icons = [];
        foreach ($serviceProviders as $serviceProvider) {
            $icons[] = $serviceProvider->getIcon();
        }

        // 批量获取所有图标的链接
        $iconUrlMap = $this->fileDomainService->getLinks($organizationCode, array_unique($icons));

        // 只处理图标URL，直接返回实体对象
        foreach ($serviceProviders as $serviceProvider) {
            $icon = $serviceProvider->getIcon();

            // 如果有URL映射，使用映射的URL
            if (isset($iconUrlMap[$icon])) {
                $serviceProvider->setIcon($iconUrlMap[$icon]->getUrl());
            }
        }
    }

    /**
     * 处理服务商配置图标.
     *
     * @param ProviderConfigDTO[] $providerConfigs 服务商配置DTO列表
     */
    private function processProviderConfigIcons(array $providerConfigs): void
    {
        if (empty($providerConfigs)) {
            return;
        }

        $iconMappings = [];

        // 收集服务商图标
        foreach ($providerConfigs as $configDTO) {
            $this->collectProviderIcon($configDTO, $iconMappings);
        }

        // 批量处理图标URL
        $this->batchProcessIcons($iconMappings);
    }

    /**
     * 收集服务商图标信息.
     */
    private function collectProviderIcon(ProviderConfigDTO|ProviderConfigModelsDTO $provider, array &$iconMappings): void
    {
        $providerIcon = $provider->getIcon();
        if (empty($providerIcon)) {
            return;
        }

        $providerIcon = FileAssembler::formatPath($providerIcon);
        $organizationCode = $this->extractOrganizationCodeFromIcon($providerIcon);
        if ($organizationCode === null) {
            return;
        }

        if (! isset($iconMappings[$organizationCode])) {
            $iconMappings[$organizationCode] = [
                'icons' => [],
                'providerMap' => [],
                'modelMap' => [],
            ];
        }

        $iconMappings[$organizationCode]['icons'][] = $providerIcon;

        if (! isset($iconMappings[$organizationCode]['providerMap'][$providerIcon])) {
            $iconMappings[$organizationCode]['providerMap'][$providerIcon] = [];
        }
        $iconMappings[$organizationCode]['providerMap'][$providerIcon][] = $provider;
    }

    /**
     * @param array<string, string[]> $iconsByOrg
     */
    private function collectIconByOrganization(array &$iconsByOrg, string $icon): ?string
    {
        $icon = FileAssembler::formatPath($icon);
        $organizationCode = $this->extractOrganizationCodeFromIcon($icon);
        if ($organizationCode === null) {
            return null;
        }

        $iconsByOrg[$organizationCode] ??= [];
        $iconsByOrg[$organizationCode][] = $icon;

        return $icon;
    }

    private function extractOrganizationCodeFromIcon(string $icon): ?string
    {
        $separatorPosition = strpos($icon, '/');
        if ($separatorPosition === false) {
            return null;
        }

        return substr($icon, 0, $separatorPosition);
    }

    /**
     * 批量处理图标URL.
     */
    private function batchProcessIcons(array $iconMappings): void
    {
        foreach ($iconMappings as $organizationCode => $mapping) {
            /** @var string $organizationCode */
            /** @var array{icons: string[], providerMap: array<string, array>, modelMap: array<string, array>} $mapping */
            $iconUrlMap = $this->fileDomainService->getLinks($organizationCode, array_unique($mapping['icons']));

            foreach ($iconUrlMap as $icon => $fileLink) {
                /** @var string $icon */
                $url = $fileLink ? $fileLink->getUrl() : '';

                // 设置服务商图标URL
                $providerMap = $mapping['providerMap'];
                if (isset($providerMap[$icon])) {
                    $providers = $providerMap[$icon];
                    /** @var ProviderConfigDTO|ProviderConfigModelsDTO $provider */
                    foreach ($providers as $provider) {
                        $provider->setIcon($url);
                    }
                }

                // 设置模型图标URL
                $modelMap = $mapping['modelMap'];
                if (isset($modelMap[$icon])) {
                    $models = $modelMap[$icon];
                    /** @var ProviderModelDetailDTO $model */
                    foreach ($models as $model) {
                        $model->setIcon($url);
                    }
                }
            }
        }
    }
}
