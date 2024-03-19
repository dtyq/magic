<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Bootstrap\Service;

use App\Application\Agent\Official\OfficialAgentsInitializer;
use App\Application\Bootstrap\Service\Initializer\AccountInitializer;
use App\Application\Bootstrap\Service\Initializer\OrganizationInitializer;
use App\Application\Bootstrap\Service\Initializer\PermissionInitializer;
use App\Application\Bootstrap\Service\Initializer\PlatformSettingInitializer;
use App\Application\Kernel\Service\MagicSettingAppService;
use App\Application\Mode\DTO\Admin\AdminModeGroupAggregateDTO;
use App\Application\Mode\DTO\Admin\AdminModeGroupDTO;
use App\Application\Mode\DTO\Admin\AdminModeGroupModelDTO;
use App\Application\Mode\Official\ModeInitializer;
use App\Application\Mode\Service\AdminModeAppService;
use App\Application\ModelGateway\Official\OfficialAccessTokenInitializer;
use App\Application\Provider\Official\AiAbilityInitializer;
use App\Application\Provider\Official\ServiceProviderInitializer;
use App\Application\Provider\Service\AdminProviderAppService;
use App\Domain\Provider\DTO\Factory\ProviderConfigFactory;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Event\ProviderConfigCreatedEvent;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Bootstrap\DTO\Request\BootstrapExecuteRequestDTO;
use App\Interfaces\Provider\DTO\ConnectivityTestByConfigRequest;
use App\Interfaces\Provider\DTO\SaveProviderModelDTO;
use Hyperf\DbConnection\Db;
use Psr\EventDispatcher\EventDispatcherInterface;
use Throwable;

class BootstrapInitializationAppService
{
    public function __construct(
        private readonly LockerInterface $locker,
        private readonly OrganizationInitializer $organizationInitializer,
        private readonly AccountInitializer $accountInitializer,
        private readonly PermissionInitializer $permissionInitializer,
        private readonly AdminProviderDomainService $adminProviderDomainService,
        private readonly ProviderConfigDomainService $providerConfigDomainService,
        private readonly AdminProviderAppService $adminProviderAppService,
        private readonly EventDispatcherInterface $eventDispatcher,
        private readonly AdminModeAppService $adminModeAppService,
        private readonly PlatformSettingInitializer $platformSettingInitializer,
        private readonly MagicSettingAppService $magicSettingAppService,
    ) {
    }

    /**
     * @return array{
     *   success:bool,
     *   initialization:array{
     *     organization:array,
     *     account:array,
     *     permission:array,
     *     platform_setting:array
     *   }
     * }
     */
    public function initialize(BootstrapExecuteRequestDTO $requestDTO): array
    {
        $organizationCode = trim($this->getOfficeOrganizationCode());
        if ($organizationCode === '') {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                'common.empty',
                ['label' => 'service_provider.office_organization']
            );
        }

        $organizationNameI18n = $this->getOfficeOrganizationNameI18n();
        $lockName = 'bootstrap:execute:' . $organizationCode;
        $owner = $this->generateLockOwner();

        if (! $this->locker->mutexLock($lockName, $owner, 30)) {
            ExceptionBuilder::throw(GenericErrorCode::TooManyRequests);
        }

        try {
            $initialization = $this->runInTransaction(function () use ($requestDTO, $organizationCode, $organizationNameI18n) {
                $organizationResult = $this->organizationInitializer->initialize(
                    organizationCode: $organizationCode,
                    organizationNameI18n: $organizationNameI18n
                );

                $accountResult = $this->accountInitializer->initialize(
                    organizationCode: $organizationCode,
                    phone: $requestDTO->getPhone(),
                    plainPassword: $requestDTO->getPassword(),
                    rootDepartmentId: (string) ($organizationResult['root_department_id'] ?? '')
                );

                $permissionResult = $this->permissionInitializer->initialize(
                    organizationCode: $organizationCode,
                    userId: (string) $accountResult['admin_user_id'],
                    magicId: (string) $accountResult['admin_magic_id']
                );

                // 初始化 Access Token（参考 init:official token 步骤）
                $accessTokenResult = $this->initAccessToken(null);

                // 初始化服务商（参考 init:official providers 步骤）
                $serviceProviderResult = $this->initServiceProvider();

                // 初始化模式（参考 init:official modes 步骤）
                $modeResult = $this->initMode();

                // 初始化大模型（根据 serviceProviderModel 创建服务商配置和模型）
                $llmResult = $this->initLLM($requestDTO, $organizationCode);

                // 创建官方员工（参考 super-magic:create-official-agents 命令）
                $agentsResult = $this->createOfficialAgents((string) $accountResult['admin_user_id'], $requestDTO->getSelectOfficialAgentsCodes());

                // 初始化 AI 能力（参考 ai-abilities:init 命令）
                $aiAbilityResult = $this->initAiAbility();

                unset($organizationResult['root_department_id']);

                return [
                    'organization' => $organizationResult,
                    'account' => $accountResult,
                    'permission' => $permissionResult,
                    'service_provider' => $serviceProviderResult,
                    'llm' => $llmResult,
                    'mode' => $modeResult,
                    'ai_ability' => $aiAbilityResult,
                    'agents' => $agentsResult,
                    'access_token' => $accessTokenResult,
                ];
            });

            $initialization['platform_setting'] = $this->platformSettingInitializer->initialize(
                agentInfo: $requestDTO->getAgentInfo(),
                agentName: $requestDTO->getAgentName(),
                agentDescription: $requestDTO->getAgentDescription(),
            );

            $globalConfig = $this->magicSettingAppService->get();
            if ($globalConfig->isNeedInitial()) {
                $globalConfig->setNeedInitial(false);
                $this->magicSettingAppService->save($globalConfig);
            }

            return [
                'success' => true,
                'initialization' => $initialization,
            ];
        } finally {
            try {
                $this->locker->release($lockName, $owner);
            } catch (Throwable) {
            }
        }
    }

    protected function getOfficeOrganizationCode(): string
    {
        return (string) config('service_provider.office_organization', '');
    }

    /**
     * @return array{zh_CN:string,en_US:string}
     */
    protected function getOfficeOrganizationNameI18n(): array
    {
        return OfficialOrganizationUtil::getOfficialOrganizationNameI18n();
    }

    protected function generateLockOwner(): string
    {
        return bin2hex(random_bytes(8));
    }

    protected function runInTransaction(callable $callback): mixed
    {
        return Db::transaction($callback);
    }

    /**
     * 创建官方员工（参考 super-magic:create-official-agents 命令）.
     *
     * @param string $userId 用户ID
     * @param array<string> $agentCodes 要同步的员工 code，为空则同步全部
     * @return array{success: bool, message: string, success_count: int, skip_count: int, fail_count: int, results: array}
     */
    protected function createOfficialAgents(string $userId, array $agentCodes = []): array
    {
        $result = OfficialAgentsInitializer::init($userId, $agentCodes);
        if (($result['success'] ?? false) !== true) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, $result['message'] ?? 'bootstrap.config_missing');
        }

        return $result;
    }

    /**
     * 初始化 AI 能力（参考 ai-abilities:init 命令）.
     *
     * @return array{success: bool, message: string, count: int}
     */
    protected function initAiAbility(): array
    {
        $result = AiAbilityInitializer::init();
        if (($result['success'] ?? false) !== true) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, $result['message'] ?? 'bootstrap.config_missing');
        }

        return $result;
    }

    /**
     * 初始化大模型（根据 serviceProviderModel 创建服务商配置和模型）.
     *
     * @return array{success: bool, config_id?: string, model_id?: string, message?: string}
     */
    protected function initLLM(BootstrapExecuteRequestDTO $requestDTO, string $organizationCode): array
    {
        $serviceProviderModel = $requestDTO->getServiceProviderModel();
        if ($serviceProviderModel === null || empty($serviceProviderModel->getProviderCode()) || empty($serviceProviderModel->getModelVersion())) {
            return ['success' => true, 'message' => 'skip'];
        }

        $providerConfigEntity = $this->createProviderConfigEntity($serviceProviderModel, $organizationCode);
        $configId = (string) $providerConfigEntity->getId();

        $authorization = new MagicUserAuthorization();
        $authorization->setId('system');
        $authorization->setOrganizationCode($organizationCode);

        $modelResult = $this->saveProviderModel($serviceProviderModel, $configId, $organizationCode);
        $providerModelId = $modelResult['provider_model_id'];
        $modelId = $modelResult['model_id'];

        $groupId = $this->addModelToDefaultModeGroup($authorization, $serviceProviderModel, $providerModelId, $modelId);

        return [
            'success' => true,
            'config_id' => $configId,
            'model_id' => $providerModelId,
            'mode_group_id' => $groupId,
        ];
    }

    /**
     * 保存服务商模型.
     *
     * @return array{provider_model_id: null|int|string, model_id: string}
     */
    protected function saveProviderModel(
        ConnectivityTestByConfigRequest $serviceProviderModel,
        string $configId,
        string $organizationCode
    ): array {
        $modelType = $this->resolveBootstrapModelType($serviceProviderModel);
        $category = $this->resolveBootstrapCategory($serviceProviderModel);

        $authorization = new MagicUserAuthorization();
        $authorization->setId('system');
        $authorization->setOrganizationCode($organizationCode);

        $saveModelDTO = new SaveProviderModelDTO([
            'service_provider_config_id' => $configId,
            'model_version' => $serviceProviderModel->getModelVersion(),
            'model_id' => $serviceProviderModel->getModelVersion(),
            'model_type' => $modelType->value,
            'name' => $serviceProviderModel->getModelVersion(),
            'category' => $category->value,
            'status' => Status::Enabled->value,
        ]);

        $modelResult = $this->adminProviderAppService->saveModel($authorization, $saveModelDTO);

        return [
            'provider_model_id' => $modelResult['id'] ?? null,
            'model_id' => $modelResult['model_id'] ?? $serviceProviderModel->getModelVersion(),
        ];
    }

    /**
     * 将模型加入默认模式分组.
     *
     * @param null|int|string $providerModelId 服务商模型ID
     * @return null|string 分组ID，未添加时返回 null
     */
    protected function addModelToDefaultModeGroup(
        MagicUserAuthorization $authorization,
        ConnectivityTestByConfigRequest $serviceProviderModel,
        null|int|string $providerModelId,
        string $modelId
    ): ?string {
        $defaultModeDTO = $this->adminModeAppService->getDefaultMode($authorization);
        if ($defaultModeDTO === null || $providerModelId === null) {
            return null;
        }

        $newGroup = new AdminModeGroupDTO([
            'id' => '',
            'mode_id' => $defaultModeDTO->getMode()->getId(),
            'name_i18n' => ['zh_CN' => '默认', 'en_US' => 'Default'],
            'icon' => '',
            'description' => '',
            'sort' => 0,
            'status' => true,
        ]);
        $newModel = new AdminModeGroupModelDTO([
            'model_id' => $modelId,
            'provider_model_id' => (string) $providerModelId,
            'model_name' => $serviceProviderModel->getModelVersion(),
            'sort' => 0,
        ]);
        $newGroupAggregate = new AdminModeGroupAggregateDTO($newGroup, [$newModel]);
        $groups = $defaultModeDTO->getGroups();
        $groups[] = $newGroupAggregate;
        $defaultModeDTO->setGroups($groups);
        $savedModeDTO = $this->adminModeAppService->saveModeConfig($authorization, $defaultModeDTO);
        $lastGroup = $savedModeDTO->getGroups()[count($savedModeDTO->getGroups()) - 1];

        return $lastGroup ? $lastGroup->getGroup()->getId() : null;
    }

    /**
     * 创建服务商配置实体.
     */
    protected function createProviderConfigEntity(
        ConnectivityTestByConfigRequest $serviceProviderModel,
        string $organizationCode
    ): ProviderConfigEntity {
        $category = $this->resolveBootstrapCategory($serviceProviderModel);
        $provider = $this->adminProviderDomainService->getProviderByCodeAndCategory(
            $serviceProviderModel->getProviderCode(),
            $category->value
        );
        if ($provider === null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotFound, 'bootstrap.provider_not_found');
        }

        $dataIsolation = ProviderDataIsolation::create($organizationCode, 'system');
        $providerConfigEntity = new ProviderConfigEntity();
        $providerConfigEntity->setServiceProviderId($provider->getId());
        $providerConfigEntity->setOrganizationCode($organizationCode);
        $providerConfigEntity->setProviderCode($provider->getProviderCode());
        $providerConfigEntity->setAlias($provider->getName());
        $providerConfigEntity->setConfig(ProviderConfigFactory::create($provider->getProviderCode(), $serviceProviderModel->getServiceProviderConfig()));
        $providerConfigEntity->setTranslate([]);
        $providerConfigEntity->setSort(0);
        $providerConfigEntity = $this->providerConfigDomainService->createProviderConfig($dataIsolation, $providerConfigEntity);
        $this->eventDispatcher->dispatch(new ProviderConfigCreatedEvent(
            $providerConfigEntity,
            $organizationCode,
            $dataIsolation->getLanguage()
        ));

        return $providerConfigEntity;
    }

    protected function resolveBootstrapModelType(ConnectivityTestByConfigRequest $serviceProviderModel): ModelType
    {
        return ModelType::tryFrom($serviceProviderModel->getModelType() ?? ModelType::LLM->value) ?? ModelType::LLM;
    }

    protected function resolveBootstrapCategory(ConnectivityTestByConfigRequest $serviceProviderModel): Category
    {
        return Category::tryFrom($serviceProviderModel->getCategory() ?? Category::LLM->value) ?? Category::LLM;
    }

    /**
     * 初始化服务商（参考 init:official providers 步骤）.
     *
     * @return array{success: bool, message: string, count: int}
     */
    protected function initServiceProvider(): array
    {
        $result = ServiceProviderInitializer::init();
        if (($result['success'] ?? false) !== true) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, $result['message'] ?? 'bootstrap.config_missing');
        }

        return $result;
    }

    /**
     * 初始化模式（参考 init:official modes 步骤）.
     *
     * @return array{success: bool, message: string, count: int}
     */
    protected function initMode(): array
    {
        $result = ModeInitializer::init();
        if (($result['success'] ?? false) !== true) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, $result['message'] ?? 'bootstrap.config_missing');
        }

        return $result;
    }

    /**
     * 初始化 Access Token（参考 init:official token 步骤）.
     *
     * @param null|string $apiKey 自定义 api-key，为 null 时自动生成
     * @return array{success: bool, message: string, access_token: null|string, application_code: null|string, is_new?: bool}
     */
    protected function initAccessToken(?string $apiKey = null): array
    {
        $result = OfficialAccessTokenInitializer::init($apiKey);
        if (($result['success'] ?? false) !== true) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, $result['message'] ?? 'bootstrap.config_missing');
        }

        return $result;
    }
}
