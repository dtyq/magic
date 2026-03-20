<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Application\Flow\ExecuteManager\NodeRunner\LLM\ToolsExecutor;
use App\Domain\Mode\Entity\ModeEntity;
use App\Domain\Mode\Entity\ValueQuery\ModeQuery;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityConfig;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityType;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use App\Infrastructure\Util\File\EasyFileTools;
use DateTime;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentMarketEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentPlaybookEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentSkillEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentVersionEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\AgentSourceType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishTargetType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentType;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentPlaybookDomainService;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentSkillDomainService;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentVersionDomainService;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\PublishAgentRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\QueryAgentsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\QueryAgentVersionsRequestDTO;
use Hyperf\DbConnection\Annotation\Transactional;
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
    protected TaskFileDomainService $taskFileDomainService;

    #[Transactional]
    public function save(Authenticatable $authorization, SuperMagicAgentEntity $entity, bool $checkPrompt = true): SuperMagicAgentEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        if (! $entity->shouldCreate() && $entity->getCode()) {
            $this->checkPermission($dataIsolation, $entity->getCode());
        }

        $validationConfig = $entity->getVisibilityConfig() ? new VisibilityConfig($entity->getVisibilityConfig()) : null;

        if ($validationConfig && $validationConfig->getVisibilityType() !== VisibilityType::NONE) {
            // 检测是否组织管理员权限
            $this->checkOrgAdmin($dataIsolation);
        }

        $iconArr = $entity->getIcon();
        if (! empty($iconArr['value'])) {
            $iconArr['value'] = EasyFileTools::formatPath($iconArr['value']);
            $entity->setIcon($iconArr);
        }

        $entity = $this->superMagicAgentDomainService->save($dataIsolation, $entity, $checkPrompt);

        // 保存可见性配置
        if ($validationConfig) {
            $this->resourceVisibilityDomainService->saveVisibilityConfig(
                $dataIsolation,
                ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
                $entity->getCode(),
                $validationConfig
            );
            $entity->setVisibilityConfig($validationConfig?->toArray() ?? null);
        }

        return $entity;
    }

    /**
     * 获取 Agent 详情.
     */
    /**
     * @return array{
     *     agent: SuperMagicAgentEntity,
     *     skills: array<int, SkillEntity|SkillVersionEntity>,
     *     is_store_offline: null|bool
     * }
     */
    public function show(Authenticatable $authorization, string $code, bool $withToolSchema, bool $withFileUrl = false, bool $checkPermission = true): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $flowDataIsolation = $this->createFlowDataIsolation($authorization);

        $checkPermission && $this->checkPermission($dataIsolation, $code);

        // 1. 查询 Agent 详情（包含技能列表和 Playbook 列表）
        $agent = $this->superMagicAgentDomainService->getDetail($dataIsolation, $code);

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
        $skillsMap = $this->skillDomainService->findSkillCurrentOrLatestByCodes($skillDataIsolation, $skillCodes);

        // 4. 更新 Agent、Playbook 和 Skill 的 URL（将路径转换为完整URL）
        $this->updateAgentEntityIcon($agent);
        $this->updateSkillLogoUrls($dataIsolation, $skillsMap);
        if ($withFileUrl) {
            $this->updateSkillFileUrl($dataIsolation, $skillsMap);
            $this->updateAgentFileUrl($agent);
        }

        // 5. 查询商店状态（如果是 STORE 类型）
        $isStoreOffline = null;
        if ($agent->getSourceType()->isMarket()) {
            $isStoreOffline = $this->superMagicAgentDomainService->getStoreAgentStatus($agent->getCode());
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
            'is_store_offline' => $isStoreOffline,
        ];
    }

    /**
     * @return array{
     *     agent: SuperMagicAgentEntity,
     *     skills: array<int, SkillEntity|SkillVersionEntity>,
     *     is_store_offline: null|bool
     * }
     */
    public function showLatestVersion(Authenticatable $authorization, string $code, bool $withToolSchema, bool $withFileUrl = false): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $flowDataIsolation = $this->createFlowDataIsolation($authorization);

        $baseAgent = $this->superMagicAgentDomainService->getByCodeWithUserCheck($dataIsolation, $code);

        $versionEntity = $this->superMagicAgentVersionDomainService->getCurrentOrLatestByCode($dataIsolation, $code);
        if ($versionEntity === null) {
            return $this->show($authorization, $code, $withToolSchema, $withFileUrl);
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

        $isStoreOffline = null;
        if ($agent->getSourceType()->isMarket()) {
            $isStoreOffline = $this->superMagicAgentDomainService->getStoreAgentStatus($agent->getCode());
        }

        return [
            'agent' => $agent,
            'skills' => array_values($skillsMap),
            'is_store_offline' => $isStoreOffline,
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
        $query->setSourceTypes([AgentSourceType::LOCAL_CREATE->value]);
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

        $marketQuery = new SuperMagicAgentQuery();
        $marketQuery->setCreatorId($currentUserId);
        $marketQuery->setSourceTypes([AgentSourceType::MARKET->value]);
        $marketAgents = $this->superMagicAgentDomainService->queries($dataIsolation, $marketQuery, Page::createNoPage());
        $marketCodes = array_map(static fn (SuperMagicAgentEntity $agent): string => $agent->getCode(), $marketAgents['list']);

        $accessibleAgentResult = $this->getAccessibleAgentCodes($dataIsolation, $currentUserId);
        $queryCodes = array_values(array_unique(array_merge($marketCodes, $accessibleAgentResult['accessible'])));

        if ($queryCodes === []) {
            return [
                'agents' => [],
                'playbooks_map' => [],
                'store_agents_map' => [],
                'latest_versions_map' => [],
                'page' => $requestDTO->getPage(),
                'page_size' => $requestDTO->getPageSize(),
                'total' => 0,
            ];
        }

        $query = new SuperMagicAgentQuery();
        $query->setKeyword(trim($requestDTO->getKeyword()));
        $query->setLanguageCode($languageCode);
        $query->setCodes($queryCodes);
        $query->setSourceTypes([AgentSourceType::LOCAL_CREATE->value, AgentSourceType::MARKET->value]);

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
    }

    /**
     * Publish an agent version.
     *
     * @param Authenticatable $authorization Authorization user
     * @param string $code Agent code
     * @return AgentVersionEntity Created version entity
     */
    #[Transactional]
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
        $versionEntity->setPublishTargetType(PublishTargetType::from($requestDTO->getPublishTargetType()));
        $versionEntity->setPublishTargetValue($requestDTO->getPublishTargetValue());

        $fileMetadata = $this->exportFileFromProject($authorization, $code, $agentEntity->getProjectId());
        $agentEntity->setFileKey($fileMetadata['file_key']);

        return $this->superMagicAgentDomainService->publishAgent($dataIsolation, $agentEntity, $versionEntity);
    }

    /**
     * @return array{
     *     list: array<int, AgentVersionEntity>,
     *     page: int,
     *     page_size: int,
     *     total: int
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
        return [
            'list' => $result['list'],
            'page' => $requestDTO->getPage(),
            'page_size' => $requestDTO->getPageSize(),
            'total' => $result['total'],
        ];
    }

    public function touchUpdatedAt(Authenticatable $authorization, string $code): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $this->superMagicAgentDomainService->getByCodeWithUserCheck($dataIsolation, $code);
        $this->superMagicAgentDomainService->updateUpdatedAtByCode($dataIsolation, $code);
    }

    /**
     * 根据 agentCodes 获取 playbooks，返回按 code 聚合的数组.
     *
     * @param Authenticatable $authorization 用户授权信息
     * @param array<string> $agentCodes Agent 编码列表
     */
    public function getAgentPlaybooksByAgentCodesForCurrentVersion(Authenticatable $authorization, array $agentCodes): array
    {
        if (empty($agentCodes)) {
            return [];
        }

        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        $playbooksByAgentCode = $this->superMagicAgentPlaybookDomainService->getByAgentCodesForCurrentVersion($dataIsolation, $agentCodes, true);

        $playbookEntities = [];
        foreach ($playbooksByAgentCode as $playbooks) {
            $playbookEntities = array_merge($playbookEntities, $playbooks);
        }

        return $playbooksByAgentCode;
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
    public function getFeaturedAgent(Authenticatable $authorization, SuperMagicAgentQuery $query, Page $page): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $userId = $authorization->getId();

        // 获取用户可访问的智能体编码列表
        $accessibleAgentResult = $this->getAccessibleAgentCodes($dataIsolation, $userId);
        $accessibleAgentCodes = $accessibleAgentResult['codes'];
        $page->disable();

        $query->setCodes($accessibleAgentCodes);
        $query->setSelect(['id', 'code', 'name', 'description', 'icon', 'icon_type', 'name_i18n', 'description_i18n', 'organization_code']); // Only select necessary fields for list

        $result = $this->superMagicAgentDomainService->queries($dataIsolation, $query, $page);

        foreach ($result['list'] as $agent) {
            // 设置是否为公开的智能体
            if (in_array($agent->getCode(), $accessibleAgentResult['accessible'])) {
                $agent->setType(SuperMagicAgentType::Public);
            }
        }

        // 合并内置模型
        $builtinAgents = $this->getBuiltinAgent($dataIsolation);
        if (! $page->isEnabled()) {
            $builtinAgentCodes = array_map(fn ($agent) => $agent->getCode(), $builtinAgents);
            foreach ($result['list'] as $agentIndex => $agent) {
                if (in_array($agent->getCode(), $builtinAgentCodes)) {
                    unset($result['list'][$agentIndex]);
                }
            }
            $result['list'] = array_merge($builtinAgents, $result['list']);
            $result['total'] += count($builtinAgents);
        }

        // 更新icon为真实链接
        $result['list'] = $this->updateAgentEntitiesIcon($result['list']);

        return $this->categorizeAgents($result['list'], $result['total'], null);
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
     * @param array<SuperMagicAgentEntity> $agents
     * @return array{
     *     agents: array<int, SuperMagicAgentEntity>,
     *     playbooks_map: array<string, array<int, AgentPlaybookEntity>>,
     *     store_agents_map: array<string, AgentMarketEntity>,
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
                'latest_versions_map' => [],
                'page' => $requestDTO->getPage(),
                'page_size' => $requestDTO->getPageSize(),
                'total' => $total,
            ];
        }

        $agentCodes = array_map(static fn (SuperMagicAgentEntity $agent): string => $agent->getCode(), $agents);
        $playbooksMap = $this->superMagicAgentPlaybookDomainService->getByAgentCodesForCurrentVersion($dataIsolation, $agentCodes, true);

        $storeSourceCodesByAgentCode = [];
        $latestVersionLookupCodes = [];
        foreach ($agents as $agent) {
            $versionLookupCode = $agent->getCode();
            if ($agent->getSourceType()->isMarket()) {
                $versionLookupCode = $agent->getVersionCode() ?: $agent->getCode();
                $storeSourceCodesByAgentCode[$agent->getCode()] = $versionLookupCode;
            }
            $latestVersionLookupCodes[] = $versionLookupCode;
        }

        $storeAgentsMap = $storeSourceCodesByAgentCode === []
            ? []
            : $this->superMagicAgentDomainService->getStoreAgentsByAgentCodes(array_values(array_unique($storeSourceCodesByAgentCode)));
        $latestVersionsMap = $this->superMagicAgentVersionDomainService->getCurrentOrLatestByCodes(
            $dataIsolation,
            array_values(array_unique($latestVersionLookupCodes))
        );

        return [
            'agents' => $agents,
            'playbooks_map' => $playbooksMap,
            'store_agents_map' => $storeAgentsMap,
            'latest_versions_map' => $latestVersionsMap,
            'page' => $requestDTO->getPage(),
            'page_size' => $requestDTO->getPageSize(),
            'total' => $total,
        ];
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
        $skillVersions = $this->skillDomainService->findSkillCurrentOrLatestByCodes($skillDataIsolation, $skillCodes);
        foreach ($skillCodes as $skillCode) {
            if (! isset($skillVersions[$skillCode])) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'super_magic.agent.skill_version_not_found');
            }
        }

        return $skillVersions;
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
        $agent->setVersionId($versionEntity->getId());
        $agent->setVersionCode($versionEntity->getVersion());
        $agent->setProjectId($versionEntity->getProjectId());
        $agent->setFileKey($versionEntity->getFileKey());
        $agent->setCreatedAt($versionEntity->getCreatedAt() ?? $baseAgent->getCreatedAt());
        $agent->setUpdatedAt($versionEntity->getUpdatedAt() ?? $baseAgent->getUpdatedAt());

        return $agent;
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

            $entity = new SuperMagicAgentEntity();

            // 设置基本信息
            $entity->setOrganizationCode($officialAgentEntity->getOrganizationCode());
            $entity->setCode($officialAgentEntity->getCode());
            $entity->setName($officialAgentEntity->getI18nName($superMagicAgentDataIsolation->getLanguage()));
            $entity->setDescription($modeEntity->getPlaceholder());
            $entity->setIcon($officialAgentEntity->getIcon());
            $entity->setIconType($officialAgentEntity->getIconType());
            $entity->setType(SuperMagicAgentType::Built_In);
            $entity->setEnabled(true);
            $entity->setPrompt([]);
            $entity->setTools([]);

            // 设置系统创建信息
            $entity->setCreator('system');
            $entity->setCreatedAt(new DateTime());
            $entity->setModifier('system');
            $entity->setUpdatedAt(new DateTime());
            $list[] = $entity;
        }
        return $list;
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
