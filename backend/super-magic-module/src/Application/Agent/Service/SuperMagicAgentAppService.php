<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Application\Flow\ExecuteManager\NodeRunner\LLM\ToolsExecutor;
use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Mode\Entity\ModeEntity;
use App\Domain\Mode\Entity\ValueQuery\ModeQuery;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\PrincipalType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityConfig;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityDepartment;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityUser;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationType;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use App\Infrastructure\Util\File\EasyFileTools;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use DateTime;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentMarketEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentPlaybookEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentSkillEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentVersionEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\UserAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\AgentSourceType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\BuiltinSkill;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishTargetType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\AgentVersionQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentType;
use Dtyq\SuperMagic\Domain\Agent\Event\AgentSkillsAddedEvent;
use Dtyq\SuperMagic\Domain\Agent\Event\AgentSkillsRemovedEvent;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentPlaybookDomainService;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentSkillDomainService;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentVersionDomainService;
use Dtyq\SuperMagic\Domain\Agent\Service\UserAgentDomainService;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillMentionSource;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\PublishAgentRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\QueryAgentsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\QueryAgentVersionsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\AgentPublishPrefillResponseDTO;
use Hyperf\DbConnection\Annotation\Transactional;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

class SuperMagicAgentAppService extends AbstractSuperMagicAppService
{
    #[Inject]
    protected SkillDomainService $skillDomainService;

    #[Inject]
    protected ResourceVisibilityDomainService $resourceVisibilityDomainService;

    #[Inject]
    protected ProjectDomainService $projectDomainService;

    #[Inject]
    protected SuperMagicAgentSkillDomainService $superMagicAgentSkillDomainService;

    #[Inject]
    protected SuperMagicAgentPlaybookDomainService $superMagicAgentPlaybookDomainService;

    #[Inject]
    protected SuperMagicAgentVersionDomainService $superMagicAgentVersionDomainService;

    #[Inject]
    protected UserAgentDomainService $userAgentDomainService;

    #[Inject]
    protected TaskFileDomainService $taskFileDomainService;

    #[Inject]
    protected MagicDepartmentDomainService $magicDepartmentDomainService;

    #[Inject]
    protected MagicUserDomainService $magicUserDomainService;

    #[Transactional]
    public function save(Authenticatable $authorization, SuperMagicAgentEntity $entity, bool $checkPrompt = true): SuperMagicAgentEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $isCreate = $entity->shouldCreate();

        if (! $entity->shouldCreate() && $entity->getCode()) {
            $this->checkPermission($dataIsolation, $entity->getCode());
        }

        $iconArr = $entity->getIcon();
        if (! empty($iconArr['value'])) {
            $iconArr['value'] = EasyFileTools::formatPath($iconArr['value']);
            $entity->setIcon($iconArr);
        }

        $entity = $this->superMagicAgentDomainService->save($dataIsolation, $entity, $checkPrompt);

        if ($isCreate) {
            $this->saveAgentVisibility($dataIsolation, $entity->getCode(), VisibilityType::SPECIFIC, [$entity->getCreator()]);
        }

        return $entity;
    }

    /**
     * 获取 Agent 详情.
     */
    /**
     * @return array{
     *     agent: null|SuperMagicAgentEntity,
     *     skills: array<int, SkillEntity|SkillVersionEntity>,
     *     is_store_offline: null|bool,
     *     publish_type: null|string,
     *     allowed_publish_target_types: array<int, string>
     * }
     */
    public function show(Authenticatable $authorization, string $code, bool $withToolSchema, bool $withFileUrl = false, bool $checkPermission = true): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $flowDataIsolation = $this->createFlowDataIsolation($authorization);

        // 审批/查看场景按资源可见性判断，支持“可见但非创建者”的访问。
        $this->ensureAgentAccessible($dataIsolation, $code);

        // 1. 查询 Agent 详情（包含技能列表和 Playbook 列表）
        $agent = $this->superMagicAgentDomainService->getDetail($dataIsolation, $code);
        $latestVersionEntity = $this->superMagicAgentVersionDomainService->getCurrentOrLatestByCode($dataIsolation, $code);

        // 2. 加载tool
        if ($withToolSchema) {
            $remoteToolCodes = [];
            foreach ($agent->getTools() as $tool) {
                if ($tool->getType()->isRemote()) {
                    $remoteToolCodes[] = $tool->getCode();
                }
            }
            // 获取工具定义
            $remoteTools = ToolsExecutor::getToolFlows($flowDataIsolation, $remoteToolCodes, true);
            foreach ($agent->getTools() as $tool) {
                $remoteTool = $remoteTools[$tool->getCode()] ?? null;
                if ($remoteTool) {
                    $tool->setSchema($remoteTool->getInput()->getForm()?->getForm()->toJsonSchema());
                }
            }
        }

        // 3. 批量查询技能详情
        $agentSkills = $agent->getSkills();
        $skillCodes = array_map(fn ($agentSkill) => $agentSkill->getSkillCode(), $agentSkills);
        $skillDataIsolation = new SkillDataIsolation();
        $skillDataIsolation->extends($dataIsolation);
        $skillDataIsolation->disabled();
        $skillsMap = $this->skillDomainService->findSkillCurrentOrLatestByCodes($skillDataIsolation, $skillCodes);

        // 4. 更新 Agent、Playbook 和 Skill 的 URL（将路径转换为完整URL）
        $this->updateAgentEntityIcon($agent);
        $this->updateSkillLogoUrls($dataIsolation, $skillsMap);
        if ($withFileUrl) {
            $this->updateSkillFileUrl($dataIsolation, $skillsMap);
            $this->updateAgentFileUrl($agent);
        }

        if ($checkPermission) {
            // 添加可见性配置
            $agent->setVisibilityConfig(
                $this->resourceVisibilityDomainService->getVisibilityConfig(
                    $dataIsolation,
                    ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
                    $code
                )?->toArray() ?? null
            );
        }

        return [
            'agent' => $agent,
            'skills' => array_values($skillsMap),
            'is_store_offline' => false,
            'publish_type' => PublishType::fromPublishTargetType($latestVersionEntity?->getPublishTargetType())?->value,
            'allowed_publish_target_types' => $this->resolveAllowedPublishTargetTypes(
                $dataIsolation,
                PublishType::fromPublishTargetType($latestVersionEntity?->getPublishTargetType())
            ),
        ];
    }

    /**
     * @return array{
     *     agent: null|SuperMagicAgentEntity,
     *     skills: array<int, SkillEntity|SkillVersionEntity>,
     *     is_store_offline: null|bool,
     *     publish_type: null|string,
     *     allowed_publish_target_types: array<int, string>
     * }
     */
    public function showLatestVersion(Authenticatable $authorization, string $code, bool $withToolSchema, bool $withFileUrl = false): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $flowDataIsolation = $this->createFlowDataIsolation($authorization);

        // 审批/查看场景按资源可见性判断，支持“可见但非创建者”的访问。
        $this->ensureAgentAccessible($dataIsolation, $code);

        $baseAgent = $this->superMagicAgentDomainService->getByCodeWithUserCheck($dataIsolation, $code);

        $versionEntity = $this->superMagicAgentVersionDomainService->getCurrentOrLatestByCode($dataIsolation, $code);
        if ($versionEntity === null) {
            return [
                'agent' => null,
                'skills' => [],
                'is_store_offline' => false,
                'publish_type' => null,
                'allowed_publish_target_types' => [],
            ];
        }

        $agent = $this->buildAgentDetailFromVersion($baseAgent, $versionEntity);

        if ($withToolSchema) {
            $remoteToolCodes = [];
            foreach ($agent->getTools() as $tool) {
                if ($tool->getType()->isRemote()) {
                    $remoteToolCodes[] = $tool->getCode();
                }
            }
            $remoteTools = ToolsExecutor::getToolFlows($flowDataIsolation, $remoteToolCodes, true);
            foreach ($agent->getTools() as $tool) {
                $remoteTool = $remoteTools[$tool->getCode()] ?? null;
                if ($remoteTool) {
                    $tool->setSchema($remoteTool->getInput()->getForm()?->getForm()->toJsonSchema());
                }
            }
        }

        $versionSkills = $this->superMagicAgentSkillDomainService->getByAgentVersionId($dataIsolation, (int) $versionEntity->getId());
        $agent->setSkills($versionSkills);
        $agent->setPlaybooks(
            $this->superMagicAgentPlaybookDomainService->getByAgentVersionId($dataIsolation, (int) $versionEntity->getId())
        );

        $skillIds = array_map(fn ($agentSkill) => $agentSkill->getSkillId(), $versionSkills);
        $skillDataIsolation = new SkillDataIsolation();
        $skillDataIsolation->extends($dataIsolation);
        $skillsMap = $this->skillDomainService->findSkillsByIds($skillDataIsolation, $skillIds);

        $this->updateAgentEntityIcon($agent);
        $this->updateSkillLogoUrls($dataIsolation, $skillsMap);
        if ($withFileUrl) {
            $this->updateSkillFileUrl($dataIsolation, $skillsMap);
            $this->updateAgentFileUrl($agent);
        }

        return [
            'agent' => $agent,
            'skills' => array_values($skillsMap),
            'is_store_offline' => false,
            'publish_type' => PublishType::fromPublishTargetType($versionEntity->getPublishTargetType())?->value,
            'allowed_publish_target_types' => $this->resolveAllowedPublishTargetTypes(
                $dataIsolation,
                PublishType::fromPublishTargetType($versionEntity->getPublishTargetType())
            ),
        ];
    }

    /**
     * 查询员工列表.
     */
    /**
     * @return array{
     *     agents: array<int, SuperMagicAgentEntity>,
     *     playbooks_map: array<string, array<int, AgentPlaybookEntity>>,
     *     store_agents_map: array<string, AgentMarketEntity>,
     *     user_agents_map: array<string, UserAgentEntity>,
     *     latest_versions_map: array<string, AgentVersionEntity>,
     *     page: int,
     *     page_size: int,
     *     total: int
     * }
     */
    public function queries(Authenticatable $authorization, QueryAgentsRequestDTO $requestDTO): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $languageCode = $dataIsolation->getLanguage() ?: LanguageEnum::EN_US->value;
        $query = new SuperMagicAgentQuery();
        $query->setKeyword(trim($requestDTO->getKeyword()));
        $query->setLanguageCode($languageCode);
        $query->setCreatorId($dataIsolation->getCurrentUserId());
        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());
        $result = $this->superMagicAgentDomainService->queries($dataIsolation, $query, $page);
        return $this->buildAgentListResult(
            dataIsolation: $dataIsolation,
            requestDTO: $requestDTO,
            agents: $result['list'],
            total: $result['total']
        );
    }

    /**
     * @return array{
     *     agents: array<int, SuperMagicAgentEntity>,
     *     playbooks_map: array<string, array<int, AgentPlaybookEntity>>,
     *     store_agents_map: array<string, AgentMarketEntity>,
     *     user_agents_map: array<string, UserAgentEntity>,
     *     latest_versions_map: array<string, AgentVersionEntity>,
     *     page: int,
     *     page_size: int,
     *     total: int
     * }
     */
    public function externalQueries(Authenticatable $authorization, QueryAgentsRequestDTO $requestDTO): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $currentUserId = $dataIsolation->getCurrentUserId();
        $languageCode = $dataIsolation->getLanguage() ?: LanguageEnum::EN_US->value;

        $accessibleAgentResult = $this->getAccessibleAgentCodes($dataIsolation, $currentUserId);
        $queryCodes = $accessibleAgentResult['accessible'];

        // 官方员工，后续官方员工要放入到可见数据里
        $officialAgentCodes = $this->getOfficialAgentCodes($authorization);

        $queryCodes = array_merge($queryCodes, $officialAgentCodes);
        if ($queryCodes === []) {
            return [
                'agents' => [],
                'playbooks_map' => [],
                'store_agents_map' => [],
                'user_agents_map' => [],
                'latest_versions_map' => [],
                'page' => $requestDTO->getPage(),
                'page_size' => $requestDTO->getPageSize(),
                'total' => 0,
            ];
        }

        $versionQuery = new AgentVersionQuery();
        $versionQuery->setCodes($queryCodes);
        $versionQuery->setKeyword(trim($requestDTO->getKeyword()));
        $versionQuery->setLanguageCode($languageCode);

        $versionPage = new Page($requestDTO->getPage(), $requestDTO->getPageSize());
        $dataIsolation->disabled();
        $versionQueryResult = $this->superMagicAgentVersionDomainService->queries(
            $dataIsolation,
            $versionQuery,
            $versionPage
        );
        $versionList = $versionQueryResult['list'];
        $total = $versionQueryResult['total'];

        $currentVersionsMap = [];
        foreach ($versionList as $entity) {
            $currentVersionsMap[$entity->getCode()] = $entity;
        }
        if ($currentVersionsMap === []) {
            return [
                'agents' => [],
                'playbooks_map' => [],
                'store_agents_map' => [],
                'user_agents_map' => [],
                'latest_versions_map' => [],
                'page' => $requestDTO->getPage(),
                'page_size' => $requestDTO->getPageSize(),
                'total' => $total,
            ];
        }

        $agents = $this->buildExternalVisibleAgentsFromVersions($dataIsolation, $currentVersionsMap);
        $userAgentOwnershipMap = $this->userAgentDomainService->findUserAgentOwnershipsByCodes(
            $dataIsolation,
            array_keys($currentVersionsMap)
        );
        $agents = $this->markInstalledMarketAgents($agents, $userAgentOwnershipMap);

        return $this->buildAgentListResult(
            dataIsolation: $dataIsolation,
            requestDTO: $requestDTO,
            agents: $agents,
            total: $total,
        );
    }

    /**
     * 更新员工绑定的技能列表（全量更新）.
     */
    public function updateAgentSkills(Authenticatable $authorization, string $code, array $skillCodes): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // Verify the caller owns the agent
        $this->checkPermission($dataIsolation, $code);

        // 1. 查询 Agent 记录（校验归属组织和当前用户）
        $agent = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $code);

        // 2. 检查是否有重复的技能 code
        if (count($skillCodes) !== count(array_unique($skillCodes))) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'super_magic.agent.duplicate_skill_code');
        }

        $skillVersions = $this->resolveAccessibleSkillsWithCurrentVersion($dataIsolation, $skillCodes);

        // 4. 创建 AgentSkillEntity 列表
        $skillEntities = [];
        foreach ($skillCodes as $index => $skillCode) {
            if (! is_string($skillCode)) {
                ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'super_magic.agent.skill_code_must_be_string');
            }

            $skillVersion = $skillVersions[$skillCode];

            // 创建 AgentSkillEntity
            $agentSkillEntity = new AgentSkillEntity();
            $agentSkillEntity->setAgentId($agent->getId());
            $agentSkillEntity->setAgentCode($agent->getCode());
            $agentSkillEntity->setSkillId($skillVersion->getId());
            $agentSkillEntity->setSkillVersionId($skillVersion->getId());
            $agentSkillEntity->setSkillCode($skillVersion->getCode());
            $agentSkillEntity->setSortOrder($index);
            $agentSkillEntity->setCreatorId($dataIsolation->getCurrentUserId());
            $agentSkillEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());

            $skillEntities[] = $agentSkillEntity;
        }

        // 5. 全量更新技能列表
        $this->superMagicAgentSkillDomainService->updateAgentSkills($dataIsolation, $agent->getCode(), $skillEntities);
    }

    /**
     * 新增员工绑定的技能（增量添加）.
     */
    public function addAgentSkills(Authenticatable $authorization, string $code, array $skillCodes): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // Verify the caller owns the agent
        $this->checkPermission($dataIsolation, $code);

        // 1. 查询 Agent 记录（校验归属组织和当前用户）
        $agent = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $code);

        // 2. 检查是否有重复的技能 code
        if (count($skillCodes) !== count(array_unique($skillCodes))) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'super_magic.agent.duplicate_skill_code');
        }

        $skillVersions = $this->resolveAccessibleSkillsWithCurrentVersion($dataIsolation, $skillCodes);

        // 4. 创建 AgentSkillEntity 列表
        $skillEntities = [];
        foreach ($skillCodes as $skillCode) {
            if (! is_string($skillCode)) {
                ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'super_magic.agent.skill_code_must_be_string');
            }

            $skillVersion = $skillVersions[$skillCode];

            // 创建 AgentSkillEntity（sort_order 会在领域服务层设置）
            $agentSkillEntity = new AgentSkillEntity();
            $agentSkillEntity->setAgentId($agent->getId());
            $agentSkillEntity->setAgentCode($agent->getCode());
            $agentSkillEntity->setSkillId($skillVersion->getId());
            $agentSkillEntity->setSkillVersionId($skillVersion->getId());
            $agentSkillEntity->setSkillCode($skillVersion->getCode());
            $agentSkillEntity->setCreatorId($dataIsolation->getCurrentUserId());
            $agentSkillEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());

            $skillEntities[] = $agentSkillEntity;
        }

        // 5. 增量添加技能
        $this->superMagicAgentSkillDomainService->addAgentSkills($dataIsolation, $agent->getCode(), $skillEntities);

        // 6. Dispatch event to sync skill files to the agent's project
        AsyncEventUtil::dispatch(new AgentSkillsAddedEvent(
            $dataIsolation,
            $code,
            $skillCodes,
            $dataIsolation->getCurrentOrganizationCode()
        ));
    }

    /**
     * 删除员工绑定的技能（增量删除）.
     */
    public function removeAgentSkills(Authenticatable $authorization, string $agentCode, array $skillCodes): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // Verify the caller owns the agent
        $this->checkPermission($dataIsolation, $agentCode);

        // 校验权限
        $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $agentCode);

        // 4. 删除技能
        $this->superMagicAgentSkillDomainService->removeAgentSkills($dataIsolation, $agentCode, $skillCodes);

        // 5. Dispatch event to remove skill files from the agent's project
        AsyncEventUtil::dispatch(new AgentSkillsRemovedEvent(
            $dataIsolation,
            $agentCode,
            $skillCodes,
            $dataIsolation->getCurrentOrganizationCode()
        ));
    }

    /**
     * Publish an agent version.
     *
     * 规则说明：
     * - `PRIVATE / MEMBER / ORGANIZATION` 属于组织内发布范围，新的发布会覆盖旧的组织内范围
     * - `MARKET` 只新增市场分发能力，不主动清理现有组织内可见范围
     * - 一旦从市场重新切回组织内范围，需要将市场状态下线，并重建当前 Agent 的可见范围
     */
    public function publishAgent(Authenticatable $authorization, string $code, PublishAgentRequestDTO $requestDTO): AgentVersionEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // Verify the caller owns the agent
        $this->checkPermission($dataIsolation, $code);

        // 1. 查询员工基础信息（校验权限和来源类型）
        $agentEntity = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $code);

        $versionEntity = new AgentVersionEntity();
        $versionEntity->setCode($code);
        $versionEntity->setVersion($requestDTO->getVersion());
        $versionEntity->setVersionDescriptionI18n($requestDTO->getVersionDescriptionI18n() ?? []);
        $versionEntity->setPublishTargetType($requestDTO->getPublishTargetType());
        $versionEntity->setPublishTargetValue($requestDTO->toPublishTargetValue());

        $fileMetadata = $this->exportFileFromProject($authorization, $code, $agentEntity->getProjectId());
        $agentEntity->setFileKey($fileMetadata['file_key']);

        Db::beginTransaction();
        try {
            $versionEntity = $this->superMagicAgentDomainService->publishAgent($dataIsolation, $agentEntity, $versionEntity);
            $this->syncPublishedAgentScope($dataIsolation, $agentEntity, $versionEntity);
            Db::commit();
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }
        return $versionEntity;
    }

    /**
     * 发布表单预填：版本号规则与 Skill 一致；发布范围取自按 created_at 最新一条版本；无版本时 publish_target 为 null.
     */
    public function getPublishPrefill(Authenticatable $authorization, string $code): AgentPublishPrefillResponseDTO
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        $this->checkPermission($dataIsolation, $code);

        $agentEntity = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $code);

        $versionRecordCount = $this->superMagicAgentVersionDomainService->countVersionsByCode($dataIsolation, $code);
        $descriptionI18n = $agentEntity->getDescriptionI18n();
        $version = sprintf('%d.0.0', $versionRecordCount + 1);
        $versionDescriptionI18n = is_array($descriptionI18n) ? $descriptionI18n : [];

        $latestVersion = $this->superMagicAgentVersionDomainService->findLatestVersionByCreatedAt($dataIsolation, $code);
        if ($latestVersion !== null) {
            $publishTargetType = $latestVersion->getPublishTargetType()->value;
            $publishTargetValue = $latestVersion->getPublishTargetType()->requiresTargetValue()
                ? $latestVersion->getPublishTargetValue()?->toArray()
                : null;
        } else {
            $publishTargetType = null;
            $publishTargetValue = null;
        }

        return new AgentPublishPrefillResponseDTO(
            version: $version,
            versionDescriptionI18n: $versionDescriptionI18n,
            publishTargetType: $publishTargetType,
            publishTargetValue: $publishTargetValue,
        );
    }

    /**
     * @return array{
     *     list: array<int, AgentVersionEntity>,
     *     page: int,
     *     page_size: int,
     *     total: int,
     *     userMap: array<string, MagicUserEntity>,
     *     memberDepartmentMap: array<string, MagicDepartmentEntity>
     * }
     */
    public function queryVersions(Authenticatable $authorization, string $code, QueryAgentVersionsRequestDTO $requestDTO): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // Verify the caller owns the agent
        $this->checkPermission($dataIsolation, $code);

        $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $code);

        $publishTargetType = $requestDTO->getPublishTargetType() ? PublishTargetType::from($requestDTO->getPublishTargetType()) : null;
        $reviewStatus = $requestDTO->getStatus() ? ReviewStatus::from($requestDTO->getStatus()) : null;
        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());

        $result = $this->superMagicAgentVersionDomainService->queriesByCode(
            $dataIsolation,
            $code,
            $publishTargetType,
            $reviewStatus,
            $page
        );

        /** @var AgentVersionEntity[] $versions */
        $versions = $result['list'];
        [$userMap, $memberDepartmentMap] = $this->batchLoadVersionRelatedEntities(
            $authorization->getOrganizationCode(),
            $versions
        );

        return [
            'list' => $versions,
            'page' => $requestDTO->getPage(),
            'page_size' => $requestDTO->getPageSize(),
            'total' => $result['total'],
            'userMap' => $userMap,
            'memberDepartmentMap' => $memberDepartmentMap,
        ];
    }

    public function touchUpdatedAt(Authenticatable $authorization, string $code): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 检查权限
        $this->checkPermission($dataIsolation, $code);

        $this->superMagicAgentDomainService->updateUpdatedAtByCode($dataIsolation, $code);
    }

    /**
     * @return array<int, array{id: string, code: string, name: string, description: string, logo: ?string, mention_source: string}>
     */
    public function getMentionSkills(Authenticatable $authorization, string $employeeCode = ''): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $language = $dataIsolation->getLanguage() ?: LanguageEnum::EN_US->value;

        $result = [];
        $seenCodes = [];

        $this->appendMentionSkills($result, $seenCodes, $this->buildSystemMentionSkills());
        $this->appendMentionSkills(
            $result,
            $seenCodes,
            $this->buildEmployeeMentionSkills($dataIsolation, $employeeCode, $language)
        );
        $this->appendMentionSkills($result, $seenCodes, $this->buildMineMentionSkills($dataIsolation, $language));

        return $result;
    }

    /**
     * 根据 agentCodes 获取 playbooks，返回按 code 聚合的数组.
     */
    public function getAgentPlaybooksByAgentVersionIds(array $agentVersionIds): array
    {
        $playbookEntities = $this->superMagicAgentPlaybookDomainService->getByAgentVersionIds($agentVersionIds);

        $agentCodeMapPlaybookEntities = [];
        foreach ($playbookEntities as $agentVersionId => $agentVersionIdMapPlaybookEntities) {
            foreach ($agentVersionIdMapPlaybookEntities as $playbookEntity) {
                $agentCodeMapPlaybookEntities[$playbookEntity->getAgentCode()][] = $playbookEntity;
            }
        }

        return $agentCodeMapPlaybookEntities;
    }

    /**
     * 绑定项目.
     */
    public function bindProject(Authenticatable $authorization, string $code, int $projectId): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 检查权限
        $this->checkPermission($dataIsolation, $code);

        $project = $this->projectDomainService->getProjectNotUserId($projectId);
        $agent = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $code);
        if (! $project) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }
        if ($project->getUserOrganizationCode() !== $agent->getOrganizationCode()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
        }
        // 检查项目的创建者是否是 agent 的创建者
        if ($project->getUserId() !== $agent->getCreator()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
        }

        // 调用 DomainService 更新项目
        $this->superMagicAgentDomainService->updateProject($dataIsolation, $code, $projectId);
    }

    /**
     * @return array{frequent: array<SuperMagicAgentEntity>, all: array<SuperMagicAgentEntity>, total: int}
     */
    public function getFeaturedAgent(Authenticatable $authorization): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $userId = $authorization->getId();

        // 获取用户可访问的智能体编码列表
        $accessibleAgentResult = $this->getAccessibleAgentCodes($dataIsolation, $userId);
        $accessibleAgentCodes = $accessibleAgentResult['codes'];

        $dataIsolation->disabled();
        $versionEntities = $this->superMagicAgentVersionDomainService->getCurrentOrLatestByCodes($dataIsolation, $accessibleAgentCodes);
        $agentEntities = $this->buildExternalVisibleAgentsFromVersions($dataIsolation, $versionEntities);

        foreach ($agentEntities as $agentEntity) {
            // 设置是否为公开的智能体
            if (in_array($agentEntity->getCode(), $accessibleAgentResult['accessible'])) {
                $agentEntity->setType(SuperMagicAgentType::Public->value);
            }
        }

        // 合并内置模型
        $builtinAgents = $this->getBuiltinAgent($dataIsolation);
        $builtinAgentCodes = array_map(fn ($agent) => $agent->getCode(), $builtinAgents);
        foreach ($agentEntities as $agentIndex => $agent) {
            if (in_array($agent->getCode(), $builtinAgentCodes)) {
                unset($agent[$agentIndex]);
            }
        }
        $result['list'] = array_merge($builtinAgents, $agentEntities);
        $result['total'] = count($result['list']);

        // 更新icon为真实链接
        $result['list'] = $this->updateAgentEntitiesIcon($result['list']);

        // 获取agent的playbook
        $agentVersionIds = array_map(fn ($agentEntity) => $agentEntity->getId(), $versionEntities);
        $agentCodeMapPlaybookEntities = $this->getAgentPlaybooksByAgentVersionIds($agentVersionIds);

        $featuredAgentResult = $this->categorizeAgents($result['list'], $result['total'], null);
        $featuredAgentResult['playbooks'] = $agentCodeMapPlaybookEntities;
        return $featuredAgentResult;
    }

    /**
     * 批量创建官方组织 Agent.
     *
     * @param Authenticatable $authorization 授权对象
     * @param string $organizationCode 组织编码
     * @param string $userId 用户ID
     * @param null|array<string> $agentCodes 指定要同步的员工 code，为空则同步全部
     * @return array{success_count: int, skip_count: int, fail_count: int, results: array}
     */
    public function createOfficialAgents(Authenticatable $authorization, string $organizationCode, string $userId, ?array $agentCodes = null): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $successCount = 0;
        $failCount = 0;
        $skipCount = 0;
        $results = [];

        $officialAgentsConfig = config('service_provider.official_agents', []);
        if ($agentCodes !== null && $agentCodes !== []) {
            $agentCodesSet = array_flip($agentCodes);
            $officialAgentsConfig = array_filter($officialAgentsConfig, static fn (array $c) => isset($agentCodesSet[$c['code']]));
        }
        foreach ($officialAgentsConfig as $config) {
            try {
                // 检查是否已存在
                $existingAgent = $this->superMagicAgentDomainService->getByCode($dataIsolation, $config['code']);
                if ($existingAgent !== null) {
                    // 已存在，跳过
                    $results[] = [
                        'code' => $config['code'],
                        'status' => 'skipped',
                        'reason' => '已存在',
                    ];
                    ++$skipCount;
                    continue;
                }

                // 创建 Entity
                $entity = new SuperMagicAgentEntity();
                $entity->setCode($config['code']);
                $entity->setNameI18n($config['name_i18n']);
                $entity->setDescriptionI18n($config['description_i18n']);
                $entity->setIcon([
                    'type' => $config['icon'],
                    'value' => $config['icon_url'],
                    'color' => $config['color'],
                ]);
                $entity->setIconType(2); // 图片类型
                $entity->setName($config['name_i18n']['en_US'] ?? $config['name_i18n']['zh_CN'] ?? '');
                $entity->setDescription($config['description_i18n']['en_US'] ?? $config['description_i18n']['zh_CN'] ?? '');
                $entity->setOrganizationCode($organizationCode);
                $entity->setCreator($userId);
                $entity->setCreatedAt((new DateTime())->format('Y-m-d H:i:s'));
                $entity->setModifier($userId);
                $entity->setUpdatedAt((new DateTime())->format('Y-m-d H:i:s'));
                $entity->setEnabled(true);
                $entity->setType(SuperMagicAgentType::Custom);
                $entity->setSourceType(AgentSourceType::LOCAL_CREATE);
                // 设置默认 prompt（空 prompt，避免验证失败）
                $entity->setPrompt([
                    'version' => '1.0.0',
                    'structure' => [
                        'type' => 'string',
                        'string' => '',
                    ],
                ]);

                // 处理 icon URL
                $iconArr = $entity->getIcon();
                if (! empty($iconArr['value'])) {
                    $iconArr['value'] = EasyFileTools::formatPath($iconArr['value']);
                    $entity->setIcon($iconArr);
                }

                // 直接调用 domain service 的 saveDirectly 方法保存
                $entity = $this->superMagicAgentDomainService->saveDirectly($dataIsolation, $entity);
                $this->saveUserAgentOwnership(
                    $dataIsolation,
                    $entity->getCode(),
                    $entity->getSourceType(),
                    $entity->getSourceId(),
                    $entity->getVersionId()
                );

                // 创建权限配置（全员可见）
                $visibilityConfig = new VisibilityConfig();
                $visibilityConfig->setVisibilityType(VisibilityType::ALL);
                $this->resourceVisibilityDomainService->saveVisibilityConfig(
                    $dataIsolation,
                    ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
                    $entity->getCode(),
                    $visibilityConfig
                );
                // 创建成功
                $results[] = [
                    'code' => $config['code'],
                    'status' => 'success',
                    'agent_id' => (string) $entity->getId(),
                ];
                ++$successCount;
            } catch (Throwable $e) {
                // 创建失败
                $results[] = [
                    'code' => $config['code'],
                    'status' => 'failed',
                    'error' => $e->getMessage(),
                ];
                ++$failCount;
            }
        }

        return [
            'success_count' => $successCount,
            'skip_count' => $skipCount,
            'fail_count' => $failCount,
            'results' => $results,
        ];
    }

    /**
     * Export agent workspace to object storage via sandbox.
     *
     * @param Authenticatable $authorization User authorization
     * @param string $code Agent code
     * @return array{file_key: string, metadata: array} Export result
     */
    public function exportAgent(Authenticatable $authorization, string $code): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // Verify the caller owns the agent
        $this->checkPermission($dataIsolation, $code);

        // Get agent entity to retrieve the bound project ID
        $agent = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $code);

        $projectId = $agent->getProjectId();
        if (empty($projectId)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        // Get project entity to build the full working directory
        $project = $this->projectDomainService->getProjectNotUserId($projectId);
        if (! $project) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        $fullPrefix = $this->taskFileDomainService->getFullPrefix($project->getUserOrganizationCode());
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $project->getWorkDir());

        return $this->superMagicAgentDomainService->exportAgentFromSandbox(
            $dataIsolation,
            $code,
            $projectId,
            $fullWorkdir
        );
    }

    /**
     * Delete an agent by code.
     *
     * For market-installed agents, this removes user ownership first.
     * For non-market agents, owner permission is required.
     */
    public function delete(Authenticatable $authorization, string $code): bool
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // Market-installed agents are removed from user ownership first.
        $userAgentOwnership = $this->userAgentDomainService->findUserAgentOwnershipByCode($dataIsolation, $code);
        if ($userAgentOwnership === null) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }

        if ($userAgentOwnership->getSourceType()->isMarket()) {
            Db::beginTransaction();
            try {
                $this->userAgentDomainService->deleteUserAgentOwnership($dataIsolation, $code);
                // Always clean up user-level visibility after market uninstallation.
                $this->removeAgentVisibilityUsers($dataIsolation, $code, [$dataIsolation->getCurrentUserId()]);
                Db::commit();
            } catch (Throwable $throwable) {
                Db::rollBack();
                throw $throwable;
            }
            return true;
        }

        // 如果是官方组织，检查该Agent的code是否在Mode的identifier中配置
        if (OfficialOrganizationUtil::isOfficialOrganization($dataIsolation->getCurrentOrganizationCode())) {
            $modeDataIsolation = $this->createModeDataIsolation($dataIsolation);
            $modeDataIsolation->setOnlyOfficialOrganization(true);
            $mode = $this->modeDomainService->getModeDetailByIdentifier($modeDataIsolation, $code);
            if ($mode !== null) {
                ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'super_magic.agent.official_agent_cannot_delete');
            }
        }

        Db::beginTransaction();
        try {
            $this->clearAgentVisibility($dataIsolation, $code);
            $this->clearAgentOwnerPermission($dataIsolation, $code);
            $result = $this->superMagicAgentDomainService->delete($dataIsolation, $code);
            Db::commit();
            return $result;
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }
    }

    /**
     * 雇用市场员工（从市场添加到用户员工列表）.
     */
    public function hireAgent(Authenticatable $authorization, string $agentMarketCode): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        $accessibleAgentResult = $this->getAccessibleAgentCodes($dataIsolation, $dataIsolation->getCurrentUserId());
        if (in_array($agentMarketCode, $accessibleAgentResult['codes'], true)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'super_magic.agent.store_agent_already_added');
        }

        Db::beginTransaction();
        try {
            // 调用 DomainService 处理业务逻辑
            $agentEntity = $this->superMagicAgentDomainService->hireAgent($dataIsolation, $agentMarketCode);
            $this->appendAgentVisibilityUsers($dataIsolation, $agentEntity->getCode(), [$dataIsolation->getCurrentUserId()]);
            Db::commit();
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }
    }

    /**
     * 批量加载版本列表关联的用户与部门信息.
     *
     * @param AgentVersionEntity[] $versions
     * @return array{0: array<string, MagicUserEntity>, 1: array<string, MagicDepartmentEntity>}
     */
    private function batchLoadVersionRelatedEntities(string $organizationCode, array $versions): array
    {
        $userIds = [];
        $memberDepartmentIds = [];

        foreach ($versions as $version) {
            if (! empty($version->getPublisherUserId())) {
                $userIds[] = $version->getPublisherUserId();
            }

            $targetValue = $version->getPublishTargetValue();
            if ($targetValue !== null && $version->getPublishTargetType()->requiresTargetValue()) {
                foreach ($targetValue->getUserIds() as $userId) {
                    $userIds[] = $userId;
                }
                foreach ($targetValue->getDepartmentIds() as $departmentId) {
                    $memberDepartmentIds[] = $departmentId;
                }
            }
        }

        $userMap = [];
        if ($userIds !== []) {
            $userMap = $this->getUsers($organizationCode, array_unique($userIds));
        }

        $memberDepartmentMap = [];
        if ($memberDepartmentIds !== []) {
            $memberDepartmentMap = $this->magicDepartmentDomainService->getDepartmentByIds(
                ContactDataIsolation::simpleMake($organizationCode),
                array_unique($memberDepartmentIds),
                true
            );
        }

        return [$userMap, $memberDepartmentMap];
    }

    /**
     * @param array<SuperMagicAgentEntity> $agents
     * @return array{
     *     agents: array<int, SuperMagicAgentEntity>,
     *     playbooks_map: array<string, array<int, AgentPlaybookEntity>>,
     *     store_agents_map: array<string, AgentMarketEntity>,
     *     user_agents_map: array<string, UserAgentEntity>,
     *     latest_versions_map: array<string, AgentVersionEntity>,
     *     page: int,
     *     page_size: int,
     *     total: int
     * }
     */
    private function buildAgentListResult(
        SuperMagicAgentDataIsolation $dataIsolation,
        QueryAgentsRequestDTO $requestDTO,
        array $agents,
        int $total
    ): array {
        $this->updateAgentEntitiesIcon($agents);
        if ($agents === []) {
            return [
                'agents' => [],
                'playbooks_map' => [],
                'store_agents_map' => [],
                'user_agents_map' => [],
                'latest_versions_map' => [],
                'page' => $requestDTO->getPage(),
                'page_size' => $requestDTO->getPageSize(),
                'total' => $total,
            ];
        }

        $agentCodes = array_map(static fn (SuperMagicAgentEntity $agent): string => $agent->getCode(), $agents);
        $rawPlaybooksMap = $this->superMagicAgentPlaybookDomainService->getByAgentCodesForCurrentVersion($dataIsolation, $agentCodes, true);
        $playbooksMap = [];
        foreach ($rawPlaybooksMap as $agentCode => $playbooks) {
            $playbooksMap[(string) $agentCode] = array_values($playbooks);
        }

        $storeSourceCodesByAgentCode = [];
        $marketSourceIds = [];
        $latestVersionLookupCodes = [];
        foreach ($agents as $agent) {
            $versionLookupCode = $agent->getCode();
            if ($agent->getSourceType()->isMarket()) {
                if ($agent->getSourceId() !== null) {
                    $marketSourceIds[$agent->getCode()] = $agent->getSourceId();
                }
            }
            $latestVersionLookupCodes[] = $versionLookupCode;
        }

        $marketSourceRecords = [];
        if ($marketSourceIds !== []) {
            $marketSourceRecords = $this->superMagicAgentDomainService->getStoreAgentsByIds(array_values($marketSourceIds));
            foreach ($marketSourceIds as $agentCode => $sourceId) {
                $marketSourceRecord = $marketSourceRecords[$sourceId] ?? null;
                if ($marketSourceRecord === null) {
                    continue;
                }

                $storeSourceCodesByAgentCode[$agentCode] = $marketSourceRecord->getAgentCode();
                $latestVersionLookupCodes[] = $marketSourceRecord->getAgentCode();
            }
        }

        $storeAgentsMap = [];
        foreach ($marketSourceIds as $agentCode => $sourceId) {
            $storeAgent = $marketSourceRecords[$sourceId] ?? null;
            if ($storeAgent !== null) {
                $storeAgentsMap[$agentCode] = $storeAgent;
            }
        }
        $userAgentsMap = $this->userAgentDomainService->findUserAgentOwnershipsByCodes($dataIsolation, $agentCodes);
        $latestVersionsMap = $this->superMagicAgentVersionDomainService->getCurrentOrLatestByCodes(
            $dataIsolation,
            array_values(array_unique($latestVersionLookupCodes))
        );

        $publisherUserMap = $this->loadAgentPublisherUserMap($agents);

        return [
            'agents' => $agents,
            'playbooks_map' => $playbooksMap,
            'store_agents_map' => $storeAgentsMap,
            'user_agents_map' => $userAgentsMap,
            'latest_versions_map' => $latestVersionsMap,
            'publisher_user_map' => $publisherUserMap,
            'page' => $requestDTO->getPage(),
            'page_size' => $requestDTO->getPageSize(),
            'total' => $total,
        ];
    }

    /**
     * 批量加载 Agent 创建者的用户信息，用于构建发布者数据.
     *
     * @param SuperMagicAgentEntity[] $agents
     * @return array<string, MagicUserEntity>
     */
    private function loadAgentPublisherUserMap(array $agents): array
    {
        $creatorIds = [];
        foreach ($agents as $agent) {
            $creatorId = $agent->getCreator();
            if (! empty($creatorId)) {
                $creatorIds[] = $creatorId;
            }
        }

        if ($creatorIds === []) {
            return [];
        }

        $publisherUserMap = [];
        $userEntities = $this->magicUserDomainService->getUserByIdsWithoutOrganization(array_unique($creatorIds));
        foreach ($userEntities as $userEntity) {
            $publisherUserMap[$userEntity->getUserId()] = $userEntity;
        }

        return $publisherUserMap;
    }

    /**
     * Export agent workspace to object storage via sandbox.
     *
     * @param Authenticatable $authorization User authorization
     * @return array{file_key: string, metadata: array} Export result
     */
    private function exportFileFromProject(Authenticatable $authorization, string $code, int $projectId): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // Get project entity to build the full working directory
        $project = $this->projectDomainService->getProjectNotUserId($projectId);
        if (! $project) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        $fullPrefix = $this->taskFileDomainService->getFullPrefix($project->getUserOrganizationCode());
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $project->getWorkDir());

        return $this->superMagicAgentDomainService->exportAgentFromSandbox(
            $dataIsolation,
            $code,
            $projectId,
            $fullWorkdir
        );
    }

    /**
     * 校验技能可见权限并补齐当前版本数据.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离
     * @param array $skillCodes 技能编码列表
     * @return array<string, SkillVersionEntity>
     */
    private function resolveAccessibleSkillsWithCurrentVersion(SuperMagicAgentDataIsolation $dataIsolation, array $skillCodes): array
    {
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        $accessibleSkillCodes = $this->resourceVisibilityDomainService->getUserAccessibleResourceCodes(
            $permissionDataIsolation,
            $dataIsolation->getCurrentUserId(),
            ResourceVisibilityResourceType::SKILL,
            $skillCodes
        );

        $accessibleSkillCodeMap = array_flip($accessibleSkillCodes);
        foreach ($skillCodes as $skillCode) {
            if (! isset($accessibleSkillCodeMap[$skillCode])) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'super_magic.agent.skill_access_denied');
            }
        }

        $skillDataIsolation = new SkillDataIsolation();
        $skillDataIsolation->extends($dataIsolation);
        $skillDataIsolation->disabled();
        $skillVersions = $this->skillDomainService->findSkillCurrentOrLatestByCodes($skillDataIsolation, $skillCodes);
        foreach ($skillCodes as $skillCode) {
            if (! isset($skillVersions[$skillCode])) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'super_magic.agent.skill_version_not_found');
            }
        }

        return $skillVersions;
    }

    /**
     * @param array<int, array{id: string, code: string, name: string, description: string, logo: ?string, mention_source: string}> $result
     * @param array<string, bool> $seenCodes
     * @param array<int, array{id: string, code: string, name: string, description: string, logo: ?string, mention_source: string}> $items
     */
    private function appendMentionSkills(array &$result, array &$seenCodes, array $items): void
    {
        foreach ($items as $item) {
            $code = $item['code'];
            if ($code === '' || isset($seenCodes[$code])) {
                continue;
            }

            $seenCodes[$code] = true;
            $result[] = $item;
        }
    }

    /**
     * @return array<int, array{id: string, code: string, name: string, description: string, logo: ?string, mention_source: string}>
     */
    private function buildSystemMentionSkills(): array
    {
        $items = [];
        foreach (BuiltinSkill::getAllBuiltinSkills() as $builtinSkill) {
            $items[] = [
                'id' => $builtinSkill->value,
                'code' => $builtinSkill->value,
                'name' => $builtinSkill->getSkillName(),
                'package_name' => $builtinSkill->getSkillName(),
                'description' => $builtinSkill->getSkillDescription(),
                'logo' => $builtinSkill->getSkillIcon() !== '' ? $builtinSkill->getSkillIcon() : null,
                'mention_source' => SkillMentionSource::SYSTEM->value,
            ];
        }

        return $items;
    }

    /**
     * @return array<int, array{id: string, code: string, name: string, description: string, logo: ?string, mention_source: string}>
     */
    private function buildEmployeeMentionSkills(
        SuperMagicAgentDataIsolation $dataIsolation,
        string $employeeCode,
        string $language
    ): array {
        $employeeCode = trim($employeeCode);
        if ($employeeCode === '') {
            return [];
        }

        $agentVersion = $this->superMagicAgentVersionDomainService->getCurrentOrLatestByCode($dataIsolation, $employeeCode);
        if ($agentVersion === null || $agentVersion->getId() === null) {
            return [];
        }

        $agentSkills = $this->superMagicAgentSkillDomainService->getByAgentVersionId(
            $dataIsolation,
            (int) $agentVersion->getId()
        );
        if ($agentSkills === []) {
            return [];
        }

        $skillVersionIds = [];
        foreach ($agentSkills as $agentSkill) {
            if ($agentSkill->getSkillVersionId() !== null) {
                $skillVersionIds[] = (int) $agentSkill->getSkillVersionId();
            }
        }

        if ($skillVersionIds === []) {
            return [];
        }

        $skillVersionMap = $this->skillDomainService->findSkillVersionsByIdsWithoutOrganizationFilter(
            array_values(array_unique($skillVersionIds))
        );
        $this->updateSkillLogoUrls($dataIsolation, array_values($skillVersionMap));

        $items = [];
        foreach ($agentSkills as $agentSkill) {
            $skillVersionId = $agentSkill->getSkillVersionId();
            if ($skillVersionId === null || ! isset($skillVersionMap[$skillVersionId])) {
                continue;
            }

            $skillVersion = $skillVersionMap[$skillVersionId];
            $items[] = [
                'id' => (string) $skillVersion->getId(),
                'code' => $skillVersion->getCode(),
                'name' => $this->resolveSkillVersionName($skillVersion, $language),
                'package_name' => $skillVersion->getPackageName(),
                'description' => $this->resolveSkillVersionDescription($skillVersion, $language),
                'logo' => $skillVersion->getLogo(),
                'mention_source' => SkillMentionSource::AGENT->value,
            ];
        }

        return $items;
    }

    /**
     * @return array<int, array{id: string, code: string, name: string, description: string, logo: ?string, mention_source: string}>
     */
    private function buildMineMentionSkills(SuperMagicAgentDataIsolation $dataIsolation, string $language): array
    {
        $accessibleSkillCodes = $this->resourceVisibilityDomainService->getUserAccessibleResourceCodes(
            $this->createPermissionDataIsolation($dataIsolation),
            $dataIsolation->getCurrentUserId(),
            ResourceVisibilityResourceType::SKILL
        );

        if ($accessibleSkillCodes === []) {
            return [];
        }

        $skillVersions = $this->skillDomainService->findCurrentSkillVersionsByCodesWithoutOrganizationFilter(
            $accessibleSkillCodes
        );
        $this->updateSkillLogoUrls($dataIsolation, array_values($skillVersions));

        $items = [];
        foreach ($skillVersions as $skillVersion) {
            $items[] = [
                'id' => (string) $skillVersion->getId(),
                'code' => $skillVersion->getCode(),
                'name' => $this->resolveSkillVersionName($skillVersion, $language),
                'package_name' => $skillVersion->getPackageName(),
                'description' => $this->resolveSkillVersionDescription($skillVersion, $language),
                'logo' => $skillVersion->getLogo(),
                'mention_source' => SkillMentionSource::MINE->value,
            ];
        }

        return $items;
    }

    private function resolveSkillVersionName(SkillVersionEntity $skillVersion, string $language): string
    {
        $nameI18n = $skillVersion->getNameI18n();
        if (! empty($nameI18n[$language])) {
            return (string) $nameI18n[$language];
        }

        if (! empty($nameI18n[LanguageEnum::DEFAULT->value])) {
            return (string) $nameI18n[LanguageEnum::DEFAULT->value];
        }

        foreach ($nameI18n as $value) {
            if (! empty($value)) {
                return (string) $value;
            }
        }

        return '';
    }

    private function resolveSkillVersionDescription(SkillVersionEntity $skillVersion, string $language): string
    {
        $descriptionI18n = $skillVersion->getDescriptionI18n() ?? [];
        if (! empty($descriptionI18n[$language])) {
            return (string) $descriptionI18n[$language];
        }

        if (! empty($descriptionI18n[LanguageEnum::DEFAULT->value])) {
            return (string) $descriptionI18n[LanguageEnum::DEFAULT->value];
        }

        foreach ($descriptionI18n as $value) {
            if (! empty($value)) {
                return (string) $value;
            }
        }

        return '';
    }

    private function buildAgentDetailFromVersion(SuperMagicAgentEntity $baseAgent, AgentVersionEntity $versionEntity): SuperMagicAgentEntity
    {
        $agent = clone $baseAgent;
        $agent->setName($versionEntity->getName());
        $agent->setDescription($versionEntity->getDescription());
        $agent->setIcon($versionEntity->getIcon());
        $agent->setIconType($versionEntity->getIconType());
        $agent->setPrompt($versionEntity->getPrompt() ?? []);
        $agent->setTools($versionEntity->getTools() ?? []);
        $agent->setType($versionEntity->getType());
        $agent->setEnabled(true);
        $agent->setNameI18n($versionEntity->getNameI18n());
        $agent->setRoleI18n($versionEntity->getRoleI18n());
        $agent->setDescriptionI18n($versionEntity->getDescriptionI18n());
        // version_id / version_code 对外已废弃，详情接口保持留空。
        $agent->setVersionId(null);
        $agent->setVersionCode(null);
        $agent->setProjectId($versionEntity->getProjectId());
        $agent->setFileKey($versionEntity->getFileKey());
        $agent->setCreatedAt($versionEntity->getCreatedAt() ?? $baseAgent->getCreatedAt());
        $agent->setUpdatedAt($versionEntity->getUpdatedAt() ?? $baseAgent->getUpdatedAt());

        return $agent;
    }

    /**
     * @param array<string, AgentVersionEntity> $currentVersionsMap
     * @return array<SuperMagicAgentEntity>
     */
    private function buildExternalVisibleAgentsFromVersions(
        SuperMagicAgentDataIsolation $dataIsolation,
        array $currentVersionsMap
    ): array {
        $agents = [];
        foreach ($currentVersionsMap as $code => $versionEntity) {
            $agent = new SuperMagicAgentEntity();
            $agent->setId($versionEntity->getId());
            $agent->setOrganizationCode($versionEntity->getOrganizationCode());
            $agent->setCode($code);
            $agent->setName($versionEntity->getI18nName($dataIsolation->getLanguage()));
            $agent->setDescription($versionEntity->getI18nDescription($dataIsolation->getLanguage()));
            $agent->setIcon($versionEntity->getIcon());
            $agent->setIconType($versionEntity->getIconType());
            $agent->setType($versionEntity->getType());
            $agent->setEnabled($versionEntity->getEnabled());
            $agent->setPrompt($versionEntity->getPrompt() ?? []);
            $agent->setTools($versionEntity->getTools() ?? []);
            $agent->setCreator($versionEntity->getCreator());
            $agent->setModifier($versionEntity->getModifier());
            $agent->setNameI18n($versionEntity->getNameI18n());
            $agent->setRoleI18n($versionEntity->getRoleI18n());
            $agent->setDescriptionI18n($versionEntity->getDescriptionI18n());
            $agent->setSourceType(AgentSourceType::LOCAL_CREATE);
            $agent->setSourceId(null);
            $agent->setVersionId(null);
            $agent->setVersionCode(null);
            $agent->setProjectId($versionEntity->getProjectId());
            $agent->setFileKey($versionEntity->getFileKey());
            $agent->setLatestPublishedAt($versionEntity->getPublishedAt());
            $agent->setCreatedAt($versionEntity->getCreatedAt() ?? '');
            $agent->setUpdatedAt($versionEntity->getUpdatedAt() ?? '');
            $agents[] = $agent;
        }

        return $agents;
    }

    /**
     * @return array<SuperMagicAgentEntity>
     */
    private function getBuiltinAgent(SuperMagicAgentDataIsolation $superMagicAgentDataIsolation): array
    {
        $modeDataIsolation = $this->createModeDataIsolation($superMagicAgentDataIsolation);
        $modeDataIsolation->setOnlyOfficialOrganization(true);
        $query = new ModeQuery(excludeDefault: true, status: true);
        $modesResult = $this->modeDomainService->getModes($modeDataIsolation, $query, Page::createNoPage());

        // 模型唯一标识
        $modeIdentifiers = array_map(fn (ModeEntity $modeEntity) => $modeEntity->getIdentifier(), $modesResult['list']);
        $officialAgentEntities = $this->getOfficialAgentEntities($superMagicAgentDataIsolation, $modeIdentifiers);

        /** @var ModeEntity $mode */
        foreach ($modesResult['list'] as $modeIndex => $mode) {
            // 过滤组织不可见
            if (! $mode->isOrganizationVisible($superMagicAgentDataIsolation->getCurrentOrganizationCode())) {
                unset($modesResult['list'][$modeIndex]);
            }
            // 过滤非官方agent
            if (! isset($officialAgentEntities[$mode->getIdentifier()])) {
                unset($modesResult['list'][$modeIndex]);
            }
        }

        $list = [];
        foreach ($modesResult['list'] as $modeEntity) {
            $officialAgentEntity = $officialAgentEntities[$modeEntity->getIdentifier()] ?? null;
            if (! $officialAgentEntity) {
                continue;
            }

            $officialAgentEntity->setType(SuperMagicAgentType::Built_In->value);
            $officialAgentEntity->setEnabled(true);
            $officialAgentEntity->setPrompt([]);
            $officialAgentEntity->setTools([]);

            // 设置系统创建信息
            $officialAgentEntity->setCreator('system');
            $officialAgentEntity->setCreatedAt(date('Y-m-d H:i:s'));
            $officialAgentEntity->setModifier('system');
            $officialAgentEntity->setUpdatedAt(date('Y-m-d H:i:s'));

            $list[] = $officialAgentEntity;
        }
        return $list;
    }

    /**
     * Save the visibility configuration for an agent.
     *
     * @param array<string> $userIds
     * @param array<string> $departmentIds
     */
    private function saveAgentVisibility(
        SuperMagicAgentDataIsolation $dataIsolation,
        string $code,
        VisibilityType $visibilityType,
        array $userIds = [],
        array $departmentIds = []
    ): void {
        $userIds = array_values(array_unique($userIds));
        $departmentIds = array_values(array_unique($departmentIds));
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        $visibilityConfig = new VisibilityConfig();
        $visibilityConfig->setVisibilityType($visibilityType);

        if ($visibilityType === VisibilityType::SPECIFIC) {
            foreach ($userIds as $userId) {
                $visibilityUser = new VisibilityUser();
                $visibilityUser->setId($userId);
                $visibilityConfig->addUser($visibilityUser);
            }

            foreach ($departmentIds as $departmentId) {
                $visibilityDepartment = new VisibilityDepartment();
                $visibilityDepartment->setId($departmentId);
                $visibilityConfig->addDepartment($visibilityDepartment);
            }
        }

        $this->resourceVisibilityDomainService->saveVisibilityConfig(
            $permissionDataIsolation,
            ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
            $code,
            $visibilityConfig
        );
    }

    /**
     * 根据最新发布版本，重新同步 Agent 的可见范围和市场分发状态。
     *
     * 这里的职责是把“发布语义”真正落成存储状态：
     * - `MARKET` 不动现有范围，只保留市场分发
     * - `PRIVATE / MEMBER / ORGANIZATION` 会重建组织内可见范围
     *
     * 注意：
     * - 从 `MARKET` 切回组织内范围时，需要把历史市场记录统一下线
     * - 真正的可见范围由 `saveAgentVisibility()` 决定，而它底层会先删掉该资源的全部旧可见记录，再写入新配置
     * - 因此这里不需要额外单独删除“非创建者可见范围”；重新保存时已经会整体覆盖
     */
    private function syncPublishedAgentScope(
        SuperMagicAgentDataIsolation $dataIsolation,
        SuperMagicAgentEntity $agentEntity,
        AgentVersionEntity $versionEntity
    ): void {
        $publishTargetType = $versionEntity->getPublishTargetType();
        if ($publishTargetType === PublishTargetType::MARKET) {
            return;
        }

        $this->superMagicAgentDomainService->offlineMarketPublishings($dataIsolation, $agentEntity->getCode());

        if ($publishTargetType === PublishTargetType::ORGANIZATION) {
            // 组织内全员可见，不需要单独保留创建者用户记录。
            $this->saveAgentVisibility($dataIsolation, $agentEntity->getCode(), VisibilityType::ALL);
            return;
        }

        if ($publishTargetType === PublishTargetType::MEMBER) {
            $publishTargetValue = $versionEntity->getPublishTargetValue();
            // 创建者要始终保留可见，否则“只选部门/成员但没选自己”时，发布者自己会失去访问权限。
            // 这里的 user_ids 只负责“显式成员可见”，部门范围仍然通过 department_ids 单独保存。
            $userIds = array_values(array_unique(array_merge(
                [$agentEntity->getCreator()],
                $publishTargetValue?->getUserIds() ?? []
            )));

            $this->saveAgentVisibility(
                $dataIsolation,
                $agentEntity->getCode(),
                VisibilityType::SPECIFIC,
                $userIds,
                $publishTargetValue?->getDepartmentIds() ?? []
            );
            return;
        }

        $this->saveAgentVisibility(
            $dataIsolation,
            $agentEntity->getCode(),
            VisibilityType::SPECIFIC,
            [$agentEntity->getCreator()]
        );
    }

    private function saveUserAgentOwnership(
        SuperMagicAgentDataIsolation $dataIsolation,
        string $agentCode,
        AgentSourceType $sourceType,
        ?int $sourceId = null,
        ?int $agentVersionId = null
    ): void {
        $entity = new UserAgentEntity([
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'user_id' => $dataIsolation->getCurrentUserId(),
            'agent_code' => $agentCode,
            'agent_version_id' => $agentVersionId,
            'source_type' => $sourceType->value,
            'source_id' => $sourceId,
        ]);

        $this->userAgentDomainService->saveUserAgentOwnership($dataIsolation, $entity);
    }

    /**
     * 市场安装场景下，给当前用户补一条用户级可见范围。
     *
     * 这里走“缺失才补”的增量逻辑，不会重建整份 Agent 可见范围。
     *
     * @param array<string> $userIds
     */
    private function appendAgentVisibilityUsers(SuperMagicAgentDataIsolation $dataIsolation, string $code, array $userIds): void
    {
        $userIds = array_values(array_unique(array_filter($userIds)));
        if ($userIds === []) {
            return;
        }

        $this->resourceVisibilityDomainService->addResourceVisibilityByPrincipalsIfMissing(
            $this->createPermissionDataIsolation($dataIsolation),
            ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
            $code,
            PrincipalType::USER,
            $userIds
        );
    }

    /**
     * 市场卸载场景下，精准移除用户级可见范围。
     *
     * @param array<string> $userIds
     */
    private function removeAgentVisibilityUsers(SuperMagicAgentDataIsolation $dataIsolation, string $code, array $userIds): void
    {
        $userIds = array_values(array_unique(array_filter($userIds)));
        if ($userIds === []) {
            return;
        }

        $this->resourceVisibilityDomainService->deleteResourceVisibilityByPrincipals(
            $this->createPermissionDataIsolation($dataIsolation),
            ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
            $code,
            PrincipalType::USER,
            $userIds
        );
    }

    /**
     * Clear the visibility configuration for an agent.
     */
    private function clearAgentVisibility(SuperMagicAgentDataIsolation $dataIsolation, string $code): void
    {
        $this->saveAgentVisibility($dataIsolation, $code, VisibilityType::NONE);
    }

    /**
     * Clear owner permissions for an agent resource.
     */
    private function clearAgentOwnerPermission(SuperMagicAgentDataIsolation $dataIsolation, string $code): void
    {
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        $this->operationPermissionDomainService->deleteByResource(
            $permissionDataIsolation,
            ResourceType::CustomAgent,
            $code
        );
    }

    /**
     * @param array<SuperMagicAgentEntity> $agents
     * @param array<string, UserAgentEntity> $marketOwnershipMap
     * @return array<SuperMagicAgentEntity>
     */
    private function markInstalledMarketAgents(array $agents, array $marketOwnershipMap): array
    {
        foreach ($agents as $agent) {
            $userAgentOwnership = $marketOwnershipMap[$agent->getCode()] ?? null;
            if ($userAgentOwnership === null || ! $userAgentOwnership->getSourceType()->isMarket()) {
                continue;
            }

            $agent->setSourceType(AgentSourceType::MARKET);
            $agent->setSourceId($userAgentOwnership->getSourceId());
            $agent->setVersionId(null);
            $agent->setVersionCode(null);
        }

        return $agents;
    }

    /**
     * @return string[]
     */
    private function resolveAllowedPublishTargetTypes(
        SuperMagicAgentDataIsolation $dataIsolation,
        ?PublishType $publishType
    ): array {
        if ($publishType === null || $publishType === PublishType::MARKET) {
            return [];
        }

        if ($dataIsolation->getOrganizationInfoManager()->getOrganizationType() === OrganizationType::Personal) {
            return [PublishTargetType::PRIVATE->value];
        }

        return $publishType->getAllowedPublishTargetTypeValues();
    }

    private function ensureAgentAccessible(SuperMagicAgentDataIsolation $dataIsolation, string $code): void
    {
        $accessibleCodes = $this->resourceVisibilityDomainService->getUserAccessibleResourceCodes(
            $this->createPermissionDataIsolation($dataIsolation),
            $dataIsolation->getCurrentUserId(),
            ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
            [$code]
        );

        if (in_array($code, $accessibleCodes, true)) {
            return;
        }

        ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $code]);
    }

    /**
     * @return SuperMagicAgentEntity[]
     */
    private function getOfficialAgentEntities(SuperMagicAgentDataIsolation $superMagicAgentDataIsolation, array $officialAgentCode): array
    {
        // 获取
        $agentQuery = new SuperMagicAgentQuery();
        $agentQuery->setEnabled(true);
        $agentQuery->setCodes($officialAgentCode);
        $agentQuery->setSelect(['id', 'code', 'name', 'description', 'icon', 'icon_type', 'name_i18n', 'description_i18n', 'organization_code']); // Only select necessary fields for list
        $officialAgentEntities = $this->superMagicAgentDomainService->queries($superMagicAgentDataIsolation, $agentQuery, Page::createNoPage());

        $map = [];
        foreach ($officialAgentEntities['list'] as $officialAgentEntity) {
            $map[$officialAgentEntity->getCode()] = $officialAgentEntity;
        }
        return $map;
    }
}
