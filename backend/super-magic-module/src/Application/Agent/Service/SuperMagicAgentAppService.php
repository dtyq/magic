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
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentSkillEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentVersionEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\AgentSourceType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentType;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentPlaybookDomainService;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentSkillDomainService;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\QueryAgentsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\AgentListItemDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\QueryAgentsResponseDTO;
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
     *     skills: array<int, SkillEntity>,
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
        $skillIds = array_map(fn ($agentSkill) => $agentSkill->getSkillId(), $agentSkills);
        $skillDataIsolation = new SkillDataIsolation();
        $skillDataIsolation->extends($dataIsolation);
        $skillsMap = $this->skillDomainService->findSkillsByIds($skillDataIsolation, $skillIds);

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
     * 查询员工列表.
     */
    public function queries(Authenticatable $authorization, QueryAgentsRequestDTO $requestDTO): QueryAgentsResponseDTO
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 1. 获取用户语言偏好，默认 en_US
        $languageCode = $dataIsolation->getLanguage() ?: LanguageEnum::EN_US->value;

        // 2. 创建查询对象
        $query = new SuperMagicAgentQuery();
        $query->setKeyword(trim($requestDTO->getKeyword()));
        $query->setLanguageCode($languageCode);
        $query->setCreatorId($dataIsolation->getCurrentUserId());

        // 3. 创建分页对象
        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());

        // 4. 查询员工列表
        $result = $this->superMagicAgentDomainService->queries($dataIsolation, $query, $page);
        $agents = $result['list'];
        $total = $result['total'];

        $this->updateAgentEntitiesIcon($agents);
        if (empty($agents)) {
            return new QueryAgentsResponseDTO(
                list: [],
                page: $requestDTO->getPage(),
                pageSize: $requestDTO->getPageSize(),
                total: $total
            );
        }

        // 5. 批量查询 Playbook 列表
        $agentCodes = array_map(fn ($agent) => $agent->getCode(), $agents);
        $playbooksMap = $this->superMagicAgentPlaybookDomainService->getByAgentCodesForCurrentVersion($dataIsolation, $agentCodes, true);

        // 6. 批量查询商店状态（仅查询 STORE 类型的员工）
        $storeAgentCodes = [];
        foreach ($agents as $agent) {
            if ($agent->getSourceType()->isMarket()) {
                $storeAgentCodes[] = $agent->getCode();
            }
        }
        $storeAgentsMap = ! empty($storeAgentCodes) ? $this->superMagicAgentDomainService->getStoreAgentsByAgentCodes($storeAgentCodes) : [];

        // 8. 构建员工列表项
        $list = [];
        foreach ($agents as $agent) {
            // 8.1 构建 Playbook 列表（features）
            $playbooks = $playbooksMap[$agent->getCode()] ?? [];
            $features = [];
            foreach ($playbooks as $playbook) {
                $features[] = [
                    'name_i18n' => $playbook->getNameI18n(),
                    'icon' => $playbook->getIcon(),
                    'theme_color' => $playbook->getThemeColor(),
                ];
            }

            // 8.2 处理商店状态和升级判断
            $isStoreOffline = null;
            $needUpgrade = false;
            if ($agent->getSourceType()->isMarket()) {
                $storeAgent = $storeAgentsMap[$agent->getCode()] ?? null;
                if ($storeAgent === null) {
                    // 商店记录不存在，已下架
                    $isStoreOffline = true;
                } else {
                    // 判断是否需要升级：比较用户的 version_id 和商店的 agent_version_id
                    $userVersionId = $agent->getVersionId();
                    $storeVersionId = $storeAgent->getAgentVersionId();
                    $needUpgrade = ($userVersionId !== null && $userVersionId !== $storeVersionId);
                    $isStoreOffline = false;
                }
            }

            // 8.3 构建列表项 DTO
            $list[] = new AgentListItemDTO(
                id: $agent->getId(),
                code: $agent->getCode(),
                nameI18n: $agent->getNameI18n(),
                roleI18n: $agent->getRoleI18n(),
                descriptionI18n: $agent->getDescriptionI18n(),
                icon: $agent->getIcon(),
                iconType: $agent->getIconType(),
                playbooks: $features,
                sourceType: $agent->getSourceType()->value,
                enabled: $agent->getEnabled() ?? false,
                isStoreOffline: $isStoreOffline,
                needUpgrade: $needUpgrade,
                pinnedAt: $agent->getPinnedAt(),
                updatedAt: $agent->getUpdatedAt(),
                createdAt: $agent->getCreatedAt()
            );
        }

        return new QueryAgentsResponseDTO(
            list: $list,
            page: $requestDTO->getPage(),
            pageSize: $requestDTO->getPageSize(),
            total: $total
        );
    }

    /**
     * 更新员工绑定的技能列表（全量更新）.
     */
    public function updateAgentSkills(Authenticatable $authorization, string $code, array $skillCodes): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 1. 查询 Agent 记录（校验归属组织和当前用户）
        $agent = $this->superMagicAgentDomainService->getByCodeWithUserCheck($dataIsolation, $code);

        // 2. 检查是否有重复的技能 code
        if (count($skillCodes) !== count(array_unique($skillCodes))) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'crew.duplicate_skill_code');
        }

        // 3. 批量查询技能信息
        $skillDataIsolation = new SkillDataIsolation();
        $skillDataIsolation->extends($dataIsolation);

        $skills = $this->skillDomainService->findUserSkillsByCodes($skillDataIsolation, $skillCodes);

        // 校验所有技能 code 是否都存在
        if (count($skills) !== count($skillCodes)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'crew.skill_not_found');
        }

        // 4. 创建 AgentSkillEntity 列表
        $skillEntities = [];
        foreach ($skillCodes as $index => $skillCode) {
            if (! is_string($skillCode)) {
                ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'crew.skill_code_must_be_string');
            }

            $skill = $skills[$skillCode];

            // 创建 AgentSkillEntity
            $agentSkillEntity = new AgentSkillEntity();
            $agentSkillEntity->setAgentId($agent->getId());
            $agentSkillEntity->setAgentCode($agent->getCode());
            $agentSkillEntity->setSkillId($skill->getId());
            $agentSkillEntity->setSkillVersionId($skill->getVersionId());
            $agentSkillEntity->setSkillCode($skill->getCode());
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

        // 1. 查询 Agent 记录（校验归属组织和当前用户）
        $agent = $this->superMagicAgentDomainService->getByCodeWithUserCheck($dataIsolation, $code);

        // 2. 检查是否有重复的技能 code
        if (count($skillCodes) !== count(array_unique($skillCodes))) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'crew.duplicate_skill_code');
        }

        // 3. 批量查询技能信息
        $skillDataIsolation = new SkillDataIsolation();
        $skillDataIsolation->extends($dataIsolation);

        $skills = $this->skillDomainService->findUserSkillsByCodes($skillDataIsolation, $skillCodes);

        // 校验所有技能 code 是否都存在
        if (count($skills) !== count($skillCodes)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'crew.skill_not_found');
        }

        // 4. 创建 AgentSkillEntity 列表
        $skillEntities = [];
        foreach ($skillCodes as $skillCode) {
            if (! is_string($skillCode)) {
                ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'crew.skill_code_must_be_string');
            }

            $skill = $skills[$skillCode];

            // 创建 AgentSkillEntity（sort_order 会在领域服务层设置）
            $agentSkillEntity = new AgentSkillEntity();
            $agentSkillEntity->setAgentId($agent->getId());
            $agentSkillEntity->setAgentCode($agent->getCode());
            $agentSkillEntity->setSkillId($skill->getId());
            $agentSkillEntity->setSkillVersionId($skill->getVersionId());
            $agentSkillEntity->setSkillCode($skill->getCode());
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

        // 校验权限
        $this->superMagicAgentDomainService->getByCodeWithUserCheck($dataIsolation, $agentCode);

        // 4. 删除技能
        $this->superMagicAgentSkillDomainService->removeAgentSkills($dataIsolation, $agentCode, $skillCodes);
    }

    /**
     * 发布员工到商店（创建待审核版本）.
     *
     * @param Authenticatable $authorization 授权对象
     * @param string $code Agent code
     * @return AgentVersionEntity 发布的版本实体
     */
    public function publishAgent(Authenticatable $authorization, string $code): AgentVersionEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 1. 查询员工基础信息（校验权限和来源类型）
        $agentEntity = $this->superMagicAgentDomainService->getByCodeWithUserCheck($dataIsolation, $code);

        // 2. 获取 icon 和 iconType
        $icon = $agentEntity->getIcon();
        $iconType = $agentEntity->getIconType();

        // 3. 使用事务调用 DomainService 发布员工
        Db::beginTransaction();
        try {
            $versionEntity = $this->superMagicAgentDomainService->publishAgent($dataIsolation, $agentEntity, $icon, $iconType);
            Db::commit();
            return $versionEntity;
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
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
