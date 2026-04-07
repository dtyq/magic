<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Application\Contact\UserSetting\UserSettingKey;
use App\Application\Flow\ExecuteManager\NodeRunner\LLM\ToolsExecutor;
use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\MagicUserSettingEntity;
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
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublisherType;
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
    protected SkillsMdSyncService $skillsMdSyncService;

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
        $this->ensureAgentAccessible($authorization, $code);

        // 忽略组织
        $dataIsolation->disabled();

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
        $this->ensureAgentAccessible($authorization, $code);

        $dataIsolation->disabled();
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

        $agent = $this->buildAgentDetailFromVersion($versionEntity);

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

        $skillCodes = array_map(fn ($agentSkill) => $agentSkill->getSkillCode(), $versionSkills);
        $skillDataIsolation = new SkillDataIsolation();
        $skillDataIsolation->extends($dataIsolation);
        $skillDataIsolation->disabled();
        $skillsMap = $this->skillDomainService->findSkillCurrentOrLatestByCodes($skillDataIsolation, $skillCodes);

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
     * 查询“我创建的员工”列表。
     *
     * 作用：
     * - 供“我的员工 / 我创建的员工”列表接口使用
     * - 只查询当前用户自己创建的 Agent
     * - 一次性补齐列表渲染需要的关联数据，避免接口层再散落查询
     *
     * 与 externalQueries 的区别：
     * - queries 面向“当前用户创建的数据”
     * - externalQueries 面向“当前用户可见但不一定由自己创建的数据”
     *
     * @return array{
     *     agents: array<int, SuperMagicAgentEntity>,
     *     playbooks_map: array<string, array<int, AgentPlaybookEntity>>,
     *     agent_market_map: array<string, AgentMarketEntity>,
     *     user_agents_map: array<string, UserAgentEntity>,
     *     latest_versions_map: array<string, AgentVersionEntity>,
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
        $agents = $result['list'];
        $total = $result['total'];

        // Normalize icons before building the list payload.
        $this->updateAgentEntitiesIcon($agents);
        if ($agents === []) {
            return [
                'agents' => [],
                'playbooks_map' => [],
                'agent_market_map' => [],
                'user_agents_map' => [],
                'latest_versions_map' => [],
                'total' => $total,
            ];
        }

        $agentCodes = array_map(static fn (SuperMagicAgentEntity $agent): string => $agent->getCode(), $agents);

        // Batch load playbooks once for all list items used by the API assembler.
        $playbooksMap = $this->superMagicAgentPlaybookDomainService->getByAgentCodesForCurrentVersion($dataIsolation, $agentCodes, true);

        // Agent codes are already available above; repository returns map keyed by agent_code.
        $agentMarketMap = $this->superMagicAgentDomainService->getStoreAgentsByAgentCodes($agentCodes);

        // Batch load user agent ownership once for all list items used by the API assembler.
        $userAgentsMap = $this->userAgentDomainService->findUserAgentOwnershipsByCodes($dataIsolation, $agentCodes);

        // Batch load versions once for all list items used by the API assembler.
        $latestVersionsMap = $this->superMagicAgentVersionDomainService->getCurrentOrLatestByCodes($dataIsolation, $agentCodes);

        $publisherUserMap = $this->loadAgentPublisherUserMap($agents);

        return [
            'agents' => $agents,
            'playbooks_map' => $playbooksMap,
            'agent_market_map' => $agentMarketMap,
            'user_agents_map' => $userAgentsMap,
            'latest_versions_map' => $latestVersionsMap,
            'publisher_user_map' => $publisherUserMap,
            'total' => $total,
        ];
    }

    /**
     * 查询“我创建的员工”列表。
     *
     * 与现有 queries 保持一致，单独暴露给前端做 tab 拆分。
     */
    public function queriesCreated(Authenticatable $authorization, QueryAgentsRequestDTO $requestDTO): array
    {
        return $this->queries($authorization, $requestDTO);
    }

    /**
     * 查询“团队共享的员工”列表。
     *
     * 仅返回当前用户可见、但并非自己创建，也不是从市场安装、且不含官方内置的 Agent。
     *
     * @return array{
     *     agents: array<int, SuperMagicAgentEntity>,
     *     playbooks_map: array<string, array<int, AgentPlaybookEntity>>,
     *     agent_market_map: array<string, AgentMarketEntity>,
     *     user_agents_map: array<string, UserAgentEntity>,
     *     latest_versions_map: array<string, AgentVersionEntity>,
     *     publisher_user_map: array<string, MagicUserEntity>,
     *     total: int
     * }
     */
    public function queriesTeamShared(Authenticatable $authorization, QueryAgentsRequestDTO $requestDTO): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $accessibleAgentResult = $this->getAccessibleAgentCodes($dataIsolation, $dataIsolation->getCurrentUserId());
        $marketInstalledCodes = $this->userAgentDomainService->findAgentCodesBySourceTypes(
            $dataIsolation,
            [AgentSourceType::MARKET->value]
        );
        $queryCodes = array_values(array_diff($accessibleAgentResult['accessible'], $marketInstalledCodes));

        return $this->queryPublishedVisibleAgentsByCodes($dataIsolation, $requestDTO, $queryCodes);
    }

    /**
     * 查询“从市场安装的员工”列表。
     *
     * 返回当前用户通过市场安装的 Agent，并包含官方内置 Agent。
     *
     * @return array{
     *     agents: array<int, SuperMagicAgentEntity>,
     *     playbooks_map: array<string, array<int, AgentPlaybookEntity>>,
     *     agent_market_map: array<string, AgentMarketEntity>,
     *     user_agents_map: array<string, UserAgentEntity>,
     *     latest_versions_map: array<string, AgentVersionEntity>,
     *     publisher_user_map: array<string, MagicUserEntity>,
     *     total: int
     * }
     */
    public function queriesMarketInstalled(Authenticatable $authorization, QueryAgentsRequestDTO $requestDTO): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $marketCodes = $this->userAgentDomainService->findAgentCodesBySourceTypes(
            $dataIsolation,
            [AgentSourceType::MARKET->value]
        );
        $officialCodes = $this->getOfficialAgentCodes($authorization);
        $queryCodes = array_values(array_unique(array_merge($marketCodes, $officialCodes)));

        return $this->queryPublishedVisibleAgentsByCodes($dataIsolation, $requestDTO, $queryCodes, true);
    }

    /**
     * 查询当前用户排序列表，并按 frequent/all 返回轻量数据.
     *
     * @return array{
     *     frequent: array<int, array{id: string, name: string, logo: ?string}>,
     *     all: array<int, array{id: string, name: string, logo: ?string}>,
     *     total: int
     * }
     */
    public function sortListQueries(Authenticatable $authorization): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $languageCode = $dataIsolation->getLanguage() ?: LanguageEnum::EN_US->value;
        $userId = $authorization->getId();

        // 排序页的数据源由两部分组成：
        // 1. 当前用户可见的 agent
        // 2. 官方 agent
        // 后续所有排序逻辑都只基于这份“当前有效集合”进行补齐。
        $accessibleAgentResult = $this->getAccessibleAgentCodes($dataIsolation, $userId);
        $officialCodes = $this->getOfficialAgentCodes($authorization);
        $queryCodes = array_values(array_unique(array_merge($accessibleAgentResult['codes'], $officialCodes)));
        if ($queryCodes === []) {
            return [
                'frequent' => [],
                'all' => [],
                'total' => 0,
            ];
        }

        $dataIsolation->disabled();
        // 统一查一次最新已发布版本，避免按官方 / 非官方拆开查询。
        $publishedVersions = $this->superMagicAgentVersionDomainService->getLatestPublishedByCodes($dataIsolation, $queryCodes);
        // 官方 agent 可能尚未发布，此时需要 builtin 配置兜底展示。
        $builtinAgents = $this->getBuiltinAgent($dataIsolation);
        $agentsForIconUpdate = array_values($publishedVersions);
        foreach ($builtinAgents as $builtinAgent) {
            $agentsForIconUpdate[] = $builtinAgent;
        }
        // icon 一次性批量转真实链接，避免不同分支重复处理。
        $this->updateAgentEntitiesIcon($agentsForIconUpdate);

        $builtinAgentMap = [];
        foreach ($builtinAgents as $builtinAgent) {
            $builtinAgentMap[$builtinAgent->getCode()] = $builtinAgent;
        }

        $items = [];
        foreach ($officialCodes as $officialCode) {
            $officialPublishedVersion = $publishedVersions[$officialCode] ?? null;
            if ($officialPublishedVersion !== null) {
                // 官方 agent 优先使用发布版本快照，保证排序页展示的是线上版本数据。
                $items[] = $this->buildSortListItem($officialPublishedVersion, $languageCode);
                continue;
            }

            $officialAgent = $builtinAgentMap[$officialCode] ?? null;
            if ($officialAgent !== null) {
                // 如果官方 agent 暂无发布版本，则退回 builtin 定义，保证官方位不会丢失。
                $items[] = $this->buildSortListItem($officialAgent, $languageCode);
            }
        }

        $officialCodeSet = array_fill_keys($officialCodes, true);
        foreach ($queryCodes as $code) {
            if (isset($officialCodeSet[$code])) {
                continue;
            }

            // 非官方 agent 仅接受“已发布版本”，没有发布版本就不进入排序列表。
            $entity = $publishedVersions[$code] ?? null;
            if ($entity !== null) {
                $items[] = $this->buildSortListItem($entity, $languageCode);
            }
        }

        if ($items === []) {
            return [
                'frequent' => [],
                'all' => [],
                'total' => 0,
            ];
        }

        // 排序配置需要和当前“可见的 agent 集合”对齐：
        // 1. frequent 为空时，全部进入 frequent，官方排前面
        // 2. 不在 frequent 且不在 all 的可见 agent，视为新增，默认补进 frequent
        $orderConfig = $this->resolveOrderConfigWithNewAgents(
            $this->getOrderConfig($authorization),
            array_map(static fn (array $item): string => $item['code'], $items),
            $officialCodes
        );

        return $this->categorizeLatestVersionItems($items, $orderConfig);
    }

    /**
     * 将指定员工列表追加到 frequent 末尾，并从 all 中移除。
     *
     * @param array<int, string> $codes
     */
    public function addToFrequent(Authenticatable $authorization, array $codes): void
    {
        $orderConfig = $this->getOrderConfig($authorization) ?? [];
        $frequentCodes = $this->normalizeOrderCodes($orderConfig['frequent'] ?? []);
        $allCodes = $this->normalizeOrderCodes($orderConfig['all'] ?? []);

        foreach ($this->normalizeOrderCodes($codes) as $code) {
            if (! in_array($code, $frequentCodes, true)) {
                $frequentCodes[] = $code;
            }
        }

        $allCodes = array_values(array_filter(
            $allCodes,
            static fn (string $currentCode): bool => ! in_array($currentCode, $frequentCodes, true)
        ));

        $this->saveOrderConfig($authorization, [
            'frequent' => $frequentCodes,
            'all' => $allCodes,
        ]);
    }

    /**
     * 查询“当前用户可见的外部员工”列表。
     *
     * 作用：
     * - 供“可见员工 / 外部员工 / 可安装员工”列表接口使用
     * - 查询当前用户有访问权限的 Agent，以及官方内置 Agent
     * - 先按版本视角筛出可见数据，再转换成列表页需要的 Agent 结构
     *
     * 与 queries 的区别：
     * - externalQueries 不要求 Agent 由当前用户创建
     * - externalQueries 需要结合可见范围、安装关系、官方内置员工一起计算
     *
     * 实现上会复用前面已经查出的版本和用户归属数据，只补查缺失部分，避免重复查询。
     *
     * @return array{
     *     agents: array<int, SuperMagicAgentEntity>,
     *     playbooks_map: array<string, array<int, AgentPlaybookEntity>>,
     *     agent_market_map: array<string, AgentMarketEntity>,
     *     user_agents_map: array<string, UserAgentEntity>,
     *     latest_versions_map: array<string, AgentVersionEntity>,
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

        // Get official agent codes.
        $officialAgentCodes = $this->getOfficialAgentCodes($authorization);

        // Merge official agent codes into query codes.
        $queryCodes = array_merge($queryCodes, $officialAgentCodes);
        if ($queryCodes === []) {
            return [
                'agents' => [],
                'playbooks_map' => [],
                'agent_market_map' => [],
                'user_agents_map' => [],
                'latest_versions_map' => [],
                'total' => 0,
            ];
        }

        $versionQuery = new AgentVersionQuery();
        $versionQuery->setCodes($queryCodes);
        $versionQuery->setKeyword(trim($requestDTO->getKeyword()));
        $versionQuery->setLanguageCode($languageCode);
        $versionQuery->setPublishedOnly(true);

        $versionPage = new Page($requestDTO->getPage(), $requestDTO->getPageSize());
        $dataIsolation->disabled();
        $versionQueryResult = $this->superMagicAgentVersionDomainService->queries($dataIsolation, $versionQuery, $versionPage);

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
                'agent_market_map' => [],
                'user_agents_map' => [],
                'latest_versions_map' => [],
                'total' => $total,
            ];
        }

        // Build external visible agents from versions.
        $agents = $this->buildExternalVisibleAgentsFromVersions($dataIsolation, $currentVersionsMap);

        // Batch load user agent ownership once for all list items used by the API assembler.
        $userAgentOwnershipMap = $this->userAgentDomainService->findUserAgentOwnershipsByCodes($dataIsolation, array_keys($currentVersionsMap));

        // Convert visible versions to list agents, then mark market-installed ones in place.
        $agents = $this->markInstalledMarketAgents($agents, $userAgentOwnershipMap);

        // Normalize icons before building the list payload.
        $this->updateAgentEntitiesIcon($agents);

        $agentCodes = array_map(static fn (SuperMagicAgentEntity $agent): string => $agent->getCode(), $agents);

        // Batch load playbooks once for all list items used by the API assembler.
        $playbooksMap = $this->superMagicAgentPlaybookDomainService->getByAgentCodesForCurrentVersion($dataIsolation, $agentCodes, true);

        // Keep logic consistent with queries(): lookup market map and latest versions by agent codes directly.
        $agentMarketMap = $this->superMagicAgentDomainService->getStoreAgentsByAgentCodes($agentCodes);

        // Batch load publisher user map once for all list items used by the API assembler.
        $publisherUserMap = $this->loadAgentPublisherUserMap($agents);

        foreach ($agentMarketMap as $agentCode => $agentMarket) {
            if (in_array($agentCode, $officialAgentCodes)) {
                $agentMarket->setPublisherType(PublisherType::OFFICIAL_BUILTIN);
            }
        }

        return [
            'agents' => $agents,
            'playbooks_map' => $playbooksMap,
            'agent_market_map' => $agentMarketMap,
            'user_agents_map' => $userAgentOwnershipMap,
            'latest_versions_map' => $currentVersionsMap,
            'publisher_user_map' => $publisherUserMap,
            'total' => $total,
        ];
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

        return $this->publishPreparedAgentVersion($authorization, $dataIsolation, $code, $agentEntity, $versionEntity, true);
    }

    /**
     * 命令补发场景：不导出项目文件，直接以空 file_key 发布到私人范围.
     */
    public function publishAgentPrivatelyWithoutExport(Authenticatable $authorization, string $code): AgentVersionEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        $this->checkPermission($dataIsolation, $code);

        $agentEntity = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $code);
        $this->hydrateAgentI18nForPublish($agentEntity);

        $versionEntity = new AgentVersionEntity();
        $versionEntity->setCode($code);
        $versionEntity->setVersion(sprintf(
            '%d.0.0',
            $this->superMagicAgentVersionDomainService->countVersionsByCode($dataIsolation, $code) + 1
        ));
        $versionEntity->setVersionDescriptionI18n($agentEntity->getDescriptionI18n() ?? []);
        $versionEntity->setPublishTargetType(PublishTargetType::PRIVATE);
        $versionEntity->setPublishTargetValue(null);

        return $this->publishPreparedAgentVersion($authorization, $dataIsolation, $code, $agentEntity, $versionEntity, true);
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
            $dataIsolation->getCurrentOrganizationCode(),
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
        $orderConfig = $this->getOrderConfig($authorization);

        $dataIsolation->disabled();
        // Featured 区需要同时考虑 builtin agent 和当前用户可见 agent。
        // builtin code 在“常用为空”时会被放到 frequent 前面。
        $builtinAgents = $this->getBuiltinAgent($dataIsolation);
        $builtinAgentCodes = array_map(fn ($agent) => $agent->getCode(), $builtinAgents);

        $accessibleAgentResult = $this->getAccessibleAgentCodes($dataIsolation, $authorization->getId());
        $availableCodes = array_values(array_unique(array_merge($accessibleAgentResult['codes'], $builtinAgentCodes)));

        // Featured 区也要复用同一套排序补齐规则，避免首页和排序页行为不一致。
        $orderConfig = $this->resolveOrderConfigWithNewAgents(
            $orderConfig,
            $availableCodes,
            $builtinAgentCodes
        );

        $frequentCodes = $this->normalizeOrderCodes($orderConfig['frequent'] ?? []);

        if ($frequentCodes !== []) {
            // frequent 一旦存在，Featured 区就严格只围绕 frequent 构建，保持首页顺序稳定。
            $builtinAgents = array_values(array_filter(
                $builtinAgents,
                static fn (SuperMagicAgentEntity $agent): bool => in_array($agent->getCode(), $frequentCodes, true)
            ));
            $builtinAgentCodes = array_map(fn ($agent) => $agent->getCode(), $builtinAgents);
            $queryAgentCodes = array_values(array_diff($frequentCodes, $builtinAgentCodes));
        } else {
            // 正常情况下 helper 已经会把 frequent 补出来。
            // 这里保留兜底逻辑，避免后续规则变更时首页数据直接为空。
            $queryAgentCodes = array_values(array_unique(array_diff(
                array_merge($accessibleAgentResult['codes'], $builtinAgentCodes),
                $builtinAgentCodes
            )));
        }

        $versionEntities = $this->superMagicAgentVersionDomainService->getLatestPublishedByCodes($dataIsolation, $queryAgentCodes);
        $agentEntities = $this->buildExternalVisibleAgentsFromVersions($dataIsolation, $versionEntities);

        $accessible = $accessibleAgentResult['accessible'] ?? [];
        foreach ($agentEntities as $agentEntity) {
            if (in_array($agentEntity->getCode(), $accessible, true)) {
                $agentEntity->setType(SuperMagicAgentType::Public->value);
            }
        }

        // 合并内置模型
        foreach ($agentEntities as $agentIndex => $agent) {
            if (in_array($agent->getCode(), $builtinAgentCodes)) {
                unset($agentEntities[$agentIndex]);
            }
        }
        $result['list'] = array_merge($builtinAgents, $agentEntities);
        $result['total'] = count($result['list']);

        // 更新icon为真实链接
        $result['list'] = $this->updateAgentEntitiesIcon($result['list']);

        // 获取agent的playbook
        $agentVersionIds = array_map(fn ($agentEntity) => $agentEntity->getId(), $versionEntities);
        $agentCodeMapPlaybookEntities = $this->getAgentPlaybooksByAgentVersionIds($agentVersionIds);

        if ($frequentCodes !== []) {
            $agentMap = [];
            foreach ($result['list'] as $agentEntity) {
                $agentMap[$agentEntity->getCode()] = $agentEntity;
            }

            $frequentAgents = [];
            foreach ($frequentCodes as $code) {
                if (isset($agentMap[$code])) {
                    // 按 frequentCodes 的顺序回填，确保返回顺序与配置完全一致。
                    $agentMap[$code]->setCategory('frequent');
                    $frequentAgents[] = $agentMap[$code];
                }
            }

            $featuredAgentResult = [
                'frequent' => $frequentAgents,
                'all' => [],
                'total' => count($frequentAgents),
            ];
        } else {
            $featuredAgentResult = $this->categorizeAgents($result['list'], $result['total'], null);
        }

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
                $entity->setRoleI18n($config['role_i18n']);
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

                // 官方内置：发布到市场（不写 workspace 导出 file_key），并自动审核通过上架
                $versionEntity = new AgentVersionEntity();
                $versionEntity->setVersion('1.0.0');
                $versionEntity->setVersionDescriptionI18n([]);
                $versionEntity->setPublishTargetType(PublishTargetType::MARKET);
                $versionEntity->setPublishTargetValue(null);
                $publishedVersion = $this->publishPreparedAgentVersion(
                    $authorization,
                    $dataIsolation,
                    $entity->getCode(),
                    $entity,
                    $versionEntity,
                    false
                );
                $reviewIsolation = clone $dataIsolation;
                $this->superMagicAgentDomainService->reviewAgentVersion(
                    $reviewIsolation->disabled(),
                    (int) $publishedVersion->getId(),
                    'APPROVED',
                    $userId,
                    PublisherType::OFFICIAL_BUILTIN->value,
                    true,
                    isset($config['sort_order']) ? (int) $config['sort_order'] : null
                );

                $this->saveUserAgentOwnership(
                    $dataIsolation,
                    $entity->getCode(),
                    $entity->getSourceType(),
                    $entity->getSourceId(),
                    (int) $publishedVersion->getId()
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
     * 按指定 Agent code 集合查询“当前用户可见的已发布版本”。
     *
     * 这个方法是“团队共享的”“从市场添加的”等拆分列表的公共查询入口：
     * - 先基于传入 code 集合收敛候选范围，避免全量扫可见 Agent。
     * - 再按关键字、语言、已发布状态查询版本数据。
     * - 最后统一组装列表页依赖的 Agent、剧本、市场信息、发布者信息等附加数据。
     *
     * `markMarketInstalled=true` 时，会额外在返回的 Agent 实体上标记市场安装态，
     * 供“从市场添加的”列表直接复用，无需再走一遍额外处理。
     *
     * @param array<string> $queryCodes
     * @return array{
     *     agents: array<int, SuperMagicAgentEntity>,
     *     playbooks_map: array<string, array<int, AgentPlaybookEntity>>,
     *     agent_market_map: array<string, AgentMarketEntity>,
     *     user_agents_map: array<string, UserAgentEntity>,
     *     latest_versions_map: array<string, AgentVersionEntity>,
     *     publisher_user_map: array<string, MagicUserEntity>,
     *     total: int
     * }
     */
    private function queryPublishedVisibleAgentsByCodes(
        SuperMagicAgentDataIsolation $dataIsolation,
        QueryAgentsRequestDTO $requestDTO,
        array $queryCodes,
        bool $markMarketInstalled = false
    ): array {
        $queryCodes = array_values(array_unique(array_filter($queryCodes)));
        if ($queryCodes === []) {
            return [
                'agents' => [],
                'playbooks_map' => [],
                'agent_market_map' => [],
                'user_agents_map' => [],
                'latest_versions_map' => [],
                'publisher_user_map' => [],
                'total' => 0,
            ];
        }

        $languageCode = $dataIsolation->getLanguage() ?: LanguageEnum::EN_US->value;
        $versionQuery = new AgentVersionQuery();
        $versionQuery->setCodes($queryCodes);
        $versionQuery->setKeyword(trim($requestDTO->getKeyword()));
        $versionQuery->setLanguageCode($languageCode);
        $versionQuery->setPublishedOnly(true);

        $versionPage = new Page($requestDTO->getPage(), $requestDTO->getPageSize());
        $dataIsolation->disabled();
        $versionQueryResult = $this->superMagicAgentVersionDomainService->queries($dataIsolation, $versionQuery, $versionPage);

        $currentVersionsMap = [];
        foreach ($versionQueryResult['list'] as $entity) {
            $currentVersionsMap[$entity->getCode()] = $entity;
        }

        if ($currentVersionsMap === []) {
            return [
                'agents' => [],
                'playbooks_map' => [],
                'agent_market_map' => [],
                'user_agents_map' => [],
                'latest_versions_map' => [],
                'publisher_user_map' => [],
                'total' => $versionQueryResult['total'],
            ];
        }

        $agents = $this->buildExternalVisibleAgentsFromVersions($dataIsolation, $currentVersionsMap);
        $userAgentOwnershipMap = $this->userAgentDomainService->findUserAgentOwnershipsByCodes(
            $dataIsolation,
            array_keys($currentVersionsMap)
        );

        if ($markMarketInstalled) {
            $agents = $this->markInstalledMarketAgents($agents, $userAgentOwnershipMap);
        }

        $this->updateAgentEntitiesIcon($agents);

        $agentCodes = array_map(static fn (SuperMagicAgentEntity $agent): string => $agent->getCode(), $agents);
        $playbooksMap = $this->superMagicAgentPlaybookDomainService->getByAgentCodesForCurrentVersion($dataIsolation, $agentCodes, true);
        $agentMarketMap = $this->superMagicAgentDomainService->getStoreAgentsByAgentCodes($agentCodes);
        $publisherUserMap = $this->loadAgentPublisherUserMap($agents);

        return [
            'agents' => $agents,
            'playbooks_map' => $playbooksMap,
            'agent_market_map' => $agentMarketMap,
            'user_agents_map' => $userAgentOwnershipMap,
            'latest_versions_map' => $currentVersionsMap,
            'publisher_user_map' => $publisherUserMap,
            'total' => $versionQueryResult['total'],
        ];
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
     * @param array<mixed> $codes
     * @return array<string>
     */
    private function normalizeOrderCodes(array $codes): array
    {
        $normalizedCodes = [];
        foreach ($codes as $code) {
            if (! is_string($code) || $code === '') {
                continue;
            }

            if (! in_array($code, $normalizedCodes, true)) {
                $normalizedCodes[] = $code;
            }
        }

        return $normalizedCodes;
    }

    /**
     * Append newly available agent codes to frequent when they are missing from both
     * frequent and all in the stored order config.
     *
     * @param null|array{frequent?: array<string>, all?: array<string>} $orderConfig
     * @param array<string> $availableCodes
     * @param array<string> $preferredFrontCodes
     * @return array{frequent: array<string>, all: array<string>}
     */
    private function resolveOrderConfigWithNewAgents(?array $orderConfig, array $availableCodes, array $preferredFrontCodes = []): array
    {
        $availableCodes = $this->normalizeOrderCodes($availableCodes);
        if ($availableCodes === []) {
            return [
                'frequent' => [],
                'all' => [],
            ];
        }
        $availableCodeSet = array_fill_keys($availableCodes, true);
        $preferredFrontCodes = array_values(array_filter(
            $this->normalizeOrderCodes($preferredFrontCodes),
            static fn (string $code): bool => isset($availableCodeSet[$code])
        ));

        $frequentCodes = array_values(array_filter(
            $this->normalizeOrderCodes($orderConfig['frequent'] ?? []),
            static fn (string $code): bool => isset($availableCodeSet[$code])
        ));
        $allCodes = array_values(array_filter(
            $this->normalizeOrderCodes($orderConfig['all'] ?? []),
            static fn (string $code): bool => isset($availableCodeSet[$code])
        ));

        // 如果原配置里 frequent 为空，则视为“当前没有常用列表”：
        // 直接把当前全部可见 agent 放进 frequent，并让官方 agent 排在最前面。
        if ($frequentCodes === []) {
            // 先把 all 补齐为“当前全部可见 agent 集合”，后续 frequent 才能基于完整集合构建。
            $knownAllCodes = array_fill_keys($allCodes, true);
            foreach ($availableCodes as $code) {
                if (! isset($knownAllCodes[$code])) {
                    $allCodes[] = $code;
                    $knownAllCodes[$code] = true;
                }
            }

            // preferredFrontCodes（例如官方 / builtin）优先放到 frequent 头部。
            $preferredFrontCodeSet = array_fill_keys($preferredFrontCodes, true);
            $frequentCodes = $preferredFrontCodes;
            $knownFrequentCodes = array_fill_keys($frequentCodes, true);
            foreach ($allCodes as $code) {
                if (isset($knownFrequentCodes[$code]) || isset($preferredFrontCodeSet[$code])) {
                    continue;
                }

                $frequentCodes[] = $code;
                $knownFrequentCodes[$code] = true;
            }

            return [
                'frequent' => $frequentCodes,
                // 既然全部 agent 都已经进入 frequent，就不再保留 all，避免前端处理重复数据。
                'all' => [],
            ];
        }

        // 其余情况保留原有 frequent / all 结构。
        // 但如果某个可见 agent 既不在 frequent，也不在 all，说明它是新增的，
        // 默认补到 frequent 末尾，避免新数据“消失”在排序配置之外。
        $knownCodes = array_fill_keys(array_merge($frequentCodes, $allCodes), true);
        foreach ($availableCodes as $code) {
            if (isset($knownCodes[$code])) {
                continue;
            }

            $frequentCodes[] = $code;
            $knownCodes[$code] = true;
        }

        $frequentCodeSet = array_flip($frequentCodes);
        $allCodes = array_values(array_filter(
            $allCodes,
            static fn (string $code): bool => ! isset($frequentCodeSet[$code])
        ));

        return [
            'frequent' => $frequentCodes,
            'all' => $allCodes,
        ];
    }

    /**
     * @param array{frequent: array<string>, all: array<string>} $orderConfig
     */
    private function saveOrderConfig(Authenticatable $authorization, array $orderConfig): void
    {
        $dataIsolation = $this->createContactDataIsolation($authorization);
        $entity = new MagicUserSettingEntity();
        $entity->setKey(UserSettingKey::SuperMagicAgentSort->value);
        $entity->setValue($orderConfig);

        $this->magicUserSettingDomainService->save($dataIsolation, $entity);
    }

    /**
     * @param array<int, array{code: string, id: string, name: string, logo: ?string, type: int}> $items
     * @param null|array{frequent?: array<string>, all?: array<string>} $orderConfig
     * @return array{
     *     frequent: array<int, array{id: string, name: string, logo: ?string}>,
     *     all: array<int, array{id: string, name: string, logo: ?string}>,
     *     total: int
     * }
     */
    private function categorizeLatestVersionItems(array $items, ?array $orderConfig): array
    {
        if (empty($orderConfig)) {
            $orderConfig = $this->buildLatestVersionDefaultOrderConfig($items);
        }

        $itemMap = [];
        foreach ($items as $item) {
            $itemMap[$item['code']] = $item;
        }

        $frequentCodes = $orderConfig['frequent'] ?? [];
        $allOrder = $orderConfig['all'] ?? [];

        $frequent = [];
        foreach ($frequentCodes as $code) {
            if (isset($itemMap[$code])) {
                $frequent[] = $this->stripLatestVersionListItem($itemMap[$code]);
            }
        }

        $all = [];
        $frequentCodesSet = array_flip($frequentCodes);
        if ($allOrder !== []) {
            foreach ($allOrder as $code) {
                if (isset($itemMap[$code]) && ! isset($frequentCodesSet[$code])) {
                    $all[] = $this->stripLatestVersionListItem($itemMap[$code]);
                }
            }

            foreach ($items as $item) {
                $code = $item['code'];
                if (! in_array($code, $allOrder, true) && ! isset($frequentCodesSet[$code])) {
                    $all[] = $this->stripLatestVersionListItem($item);
                }
            }
        } else {
            foreach ($items as $item) {
                if (! isset($frequentCodesSet[$item['code']])) {
                    $all[] = $this->stripLatestVersionListItem($item);
                }
            }
        }

        return [
            'frequent' => $frequent,
            'all' => $all,
            'total' => count($items),
        ];
    }

    /**
     * @param array<int, array{code: string, id: string, name: string, logo: ?string, type: int}> $items
     * @return array{frequent: array<string>, all: array<string>}
     */
    private function buildLatestVersionDefaultOrderConfig(array $items): array
    {
        $builtinCodes = [];
        $customCodes = [];

        foreach ($items as $item) {
            if ($item['type'] === SuperMagicAgentType::Built_In->value) {
                $builtinCodes[] = $item['code'];
                continue;
            }

            $customCodes[] = $item['code'];
        }

        return [
            'frequent' => array_slice($builtinCodes, 0, 6),
            'all' => array_merge($builtinCodes, $customCodes),
        ];
    }

    /**
     * @return array{code: string, id: string, name: string, logo: ?string, type: int}
     */
    private function buildSortListItem(AgentVersionEntity|SuperMagicAgentEntity $entity, string $languageCode): array
    {
        $icon = $entity->getIcon() ?? [];
        $type = $entity instanceof SuperMagicAgentEntity ? $entity->getType()->value : $entity->getType();

        return [
            'code' => $entity->getCode(),
            'id' => $entity->getCode(),
            'name' => $entity->getI18nName($languageCode),
            'logo' => $icon['url'] ?? $icon['value'] ?? null,
            'type' => $type,
        ];
    }

    /**
     * @param array{code: string, id: string, name: string, logo: ?string, type: int} $item
     * @return array{id: string, name: string, logo: ?string}
     */
    private function stripLatestVersionListItem(array $item): array
    {
        return [
            'id' => $item['code'],
            'code' => $item['code'],
            'name' => $item['name'],
            'logo' => $item['logo'],
        ];
    }

    /**
     * Export agent workspace to object storage via sandbox.
     *
     * @return array{file_key: string, metadata: array} Export result
     */
    /**
     * Validate that IDENTITY.md exists in the agent project before publishing.
     */
    private function validateIdentityMdExists(int $projectId, ?string $sourcePath): void
    {
        if (! $this->taskFileDomainService->existsFileByName($projectId, 'IDENTITY.md')) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::PUBLISH_IDENTITY_MD_NOT_FOUND,
                'super_magic.agent.publish.identity_md_not_found'
            );
        }
    }

    private function exportFileFromProject(
        Authenticatable $authorization,
        string $code,
        int $projectId,
        ?string $sourcePath = null
    ): array {
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
            $fullWorkdir,
            $sourcePath
        );
    }

    /**
     * Resolve optional source path for publish export.
     * Only when ".magic" directory exists in file table do we export from that subdirectory.
     */
    private function resolvePublishExportSourcePath(int $projectId): ?string
    {
        if ($projectId <= 0) {
            return null;
        }

        $magicDir = $this->taskFileDomainService->findDirectoryByPath($projectId, '.magic');

        return $magicDir !== null ? '.magic' : null;
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
                'package_name' => $builtinSkill->value,
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

        $agentVersions = $this->superMagicAgentVersionDomainService->getLatestPublishedByCodes($dataIsolation, [$employeeCode]);
        $agentVersion = $agentVersions[$employeeCode] ?? null;
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

    private function buildAgentDetailFromVersion(AgentVersionEntity $versionEntity): SuperMagicAgentEntity
    {
        $agent = new SuperMagicAgentEntity();
        $agent->setCode($versionEntity->getCode());
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
        $agent->setOrganizationCode($versionEntity->getOrganizationCode());
        $agent->setCreatedAt($versionEntity->getCreatedAt());
        $agent->setUpdatedAt($versionEntity->getUpdatedAt());

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

    private function publishPreparedAgentVersion(
        Authenticatable $authorization,
        SuperMagicAgentDataIsolation $dataIsolation,
        string $code,
        SuperMagicAgentEntity $agentEntity,
        AgentVersionEntity $versionEntity,
        bool $shouldExportFile
    ): AgentVersionEntity {
        if ($shouldExportFile) {
            $projectId = $agentEntity->getProjectId();
            $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
            if ($projectEntity !== null) {
                $this->skillsMdSyncService->syncSkillsMd(
                    $projectId,
                    $projectEntity,
                    $dataIsolation->getCurrentOrganizationCode(),
                    $projectEntity->getUserOrganizationCode()
                );
            }

            $sourcePath = $this->resolvePublishExportSourcePath($agentEntity->getProjectId());
            $this->validateIdentityMdExists($agentEntity->getProjectId(), $sourcePath);
            $fileMetadata = $this->exportFileFromProject($authorization, $code, $agentEntity->getProjectId(), $sourcePath);
            $agentEntity->setFileKey($fileMetadata['file_key']);
        } else {
            $agentEntity->setFileKey('');
        }

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

    private function hydrateAgentI18nForPublish(SuperMagicAgentEntity $agentEntity): void
    {
        $resolvedName = $this->resolvePublishTextFallback($agentEntity->getName(), $agentEntity->getNameI18n());
        if ($resolvedName !== '') {
            $agentEntity->setName($resolvedName);
            $agentEntity->setNameI18n($this->fillPublishI18nValues($agentEntity->getNameI18n(), $resolvedName));
        }

        $resolvedDescription = $this->resolvePublishTextFallback($agentEntity->getDescription(), $agentEntity->getDescriptionI18n());
        if ($resolvedDescription !== '') {
            $agentEntity->setDescription($resolvedDescription);
            $agentEntity->setDescriptionI18n($this->fillPublishI18nValues($agentEntity->getDescriptionI18n(), $resolvedDescription));
        }
    }

    private function resolvePublishTextFallback(string $text, ?array $i18n): string
    {
        $text = trim($text);
        if ($text !== '') {
            return $text;
        }

        $i18n = is_array($i18n) ? $i18n : [];
        foreach (LanguageEnum::getAllLanguageCodes() as $languageCode) {
            $value = trim((string) ($i18n[$languageCode] ?? ''));
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    private function fillPublishI18nValues(?array $i18n, string $fallback): array
    {
        $i18n = is_array($i18n) ? $i18n : [];
        $fallback = trim($fallback);
        if ($fallback === '') {
            return $i18n;
        }

        foreach (LanguageEnum::getAllLanguageCodes() as $languageCode) {
            if (trim((string) ($i18n[$languageCode] ?? '')) === '') {
                $i18n[$languageCode] = $fallback;
            }
        }

        return $i18n;
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

    private function ensureAgentAccessible(Authenticatable $dataIsolation, string $code): void
    {
        $accessibleCodes = $this->resourceVisibilityDomainService->getUserAccessibleResourceCodes(
            $this->createPermissionDataIsolation($dataIsolation),
            $dataIsolation->getId(),
            ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
            [$code]
        );

        if (in_array($code, $accessibleCodes, true)) {
            return;
        }
        $officialCodes = $this->getOfficialAgentCodes($dataIsolation);
        if (in_array($code, $officialCodes)) {
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
