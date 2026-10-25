<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Agent\Service;

use App\Application\Contact\UserSetting\UserSettingKey;
use App\Application\Flow\ExecuteManager\NodeRunner\LLM\ToolsExecutor;
use App\Application\SuperMagic\Agent\DTO\PublishAgentResultDTO;
use App\Application\SuperMagic\Publish\PublishAsyncStatusManager;
use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Mode\Entity\ModeEntity;
use App\Domain\Mode\Entity\ValueQuery\ModeQuery;
use App\Domain\OrganizationEnvironment\Entity\OrganizationEntity;
use App\Domain\OrganizationEnvironment\Service\OrganizationDomainService;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\PrincipalType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityType;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Domain\SuperMagic\Agent\Entity\AgentCategoryEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentMarketEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentPlaybookEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentSkillEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentVersionEntity;
use App\Domain\SuperMagic\Agent\Entity\SuperMagicAgentEntity;
use App\Domain\SuperMagic\Agent\Entity\UserAgentEntity;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentSourceType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\PublisherType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\PublishTargetType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\Query\AgentListScope;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\Query\AgentVersionQuery;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\ReviewStatus;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentType;
use App\Domain\SuperMagic\Agent\Event\AgentMarketOfflineEvent;
use App\Domain\SuperMagic\Agent\Event\AgentSkillsAddedEvent;
use App\Domain\SuperMagic\Agent\Event\AgentSkillsRemovedEvent;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentCategoryDomainService;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentCategoryRelationDomainService;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentMarketDomainService;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentPlaybookDomainService;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentSkillDomainService;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentVersionDomainService;
use App\Domain\SuperMagic\Agent\Service\UserAgentDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Skill\Entity\SkillEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillVersionEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillMentionSource;
use App\Domain\SuperMagic\Skill\Service\SkillDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillVersionDomainService;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRootFileIds;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskStatus;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\ErrorCode\SuperAgentErrorCode;
use App\ErrorCode\SuperMagicErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use App\Infrastructure\SuperMagic\Utils\WorkDirectoryUtil;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\File\EasyFileTools;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\SuperMagic\Agent\DTO\Request\GetMyAvailableAgentsRequestDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Request\PublishAgentRequestDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Request\QueryAgentListRequestDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Request\QueryAgentsRequestDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Request\QueryAgentVersionsRequestDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\AgentPublishPrefillResponseDTO;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Hyperf\DbConnection\Annotation\Transactional;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Qbhy\HyperfAuth\Authenticatable;
use RuntimeException;
use Throwable;

class SuperMagicAgentAppService extends AbstractSuperMagicAppService
{
    private const string REQUIRED_IDENTITY_PATH = '.magic/IDENTITY.md';

    private const string KNOWLEDGE_SEARCH_TOOL_CODE = 'search_knowledge';

    private const string AGENT_PUBLISH_EXPORT_TASK_PROMPT = 'Agent Publish Export Task';

    #[Inject]
    protected SkillDomainService $skillDomainService;

    #[Inject]
    protected SkillVersionDomainService $skillVersionDomainService;

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
    protected SuperMagicAgentMarketDomainService $superMagicAgentMarketDomainService;

    #[Inject]
    protected SuperMagicAgentCategoryDomainService $superMagicAgentCategoryDomainService;

    #[Inject]
    protected SuperMagicAgentCategoryRelationDomainService $superMagicAgentCategoryRelationDomainService;

    #[Inject]
    protected UserAgentDomainService $userAgentDomainService;

    #[Inject]
    protected TaskFileDomainService $taskFileDomainService;

    #[Inject]
    protected SkillsMdSyncService $skillsMdSyncService;

    #[Inject]
    protected PublishAsyncStatusManager $publishAsyncStatusManager;

    #[Inject]
    protected MagicDepartmentDomainService $magicDepartmentDomainService;

    #[Inject]
    protected MagicUserDomainService $magicUserDomainService;

    #[Inject]
    protected OrganizationDomainService $organizationDomainService;

    #[Inject]
    protected AgentDomainService $agentDomainService;

    #[Inject]
    protected TopicDomainService $topicDomainService;

    #[Inject]
    protected TaskDomainService $taskDomainService;

    #[Transactional]
    public function save(Authenticatable $authorization, SuperMagicAgentEntity $entity, bool $checkPrompt = true): SuperMagicAgentEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $isCreate = $entity->shouldCreate();

        if (! $entity->shouldCreate() && $entity->getCode()) {
            $this->assertAgentEditable($dataIsolation, $entity->getCode());
        }

        $iconArr = $entity->getIcon();
        if (! empty($iconArr['value'])) {
            $iconArr['value'] = EasyFileTools::formatPath($iconArr['value']);
            $entity->setIcon($iconArr);
        }

        $entity = $this->superMagicAgentDomainService->save($dataIsolation, $entity, $checkPrompt);

        if ($isCreate) {
            $this->saveAgentVisibility($dataIsolation, $entity->getCode(), VisibilityType::SPECIFIC, [$entity->getCreator()]);
            $this->grantAgentOwnerPermission($dataIsolation, $entity->getCode(), $entity->getCreator());
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
     *     operation: null|Operation
     * }
     */
    public function show(Authenticatable $authorization, string $code, bool $withToolSchema, bool $withFileUrl = false, bool $checkPermission = true): array
    {
        return $this->showWithAccessMode($authorization, $code, $withToolSchema, $withFileUrl, $checkPermission, false);
    }

    /**
     * Sandbox / OpenAPI execution preparation must require usable, not merely
     * detail-readable, employees.
     */
    public function showUsable(Authenticatable $authorization, string $code, bool $withToolSchema, bool $withFileUrl = false): array
    {
        return $this->showWithAccessMode($authorization, $code, $withToolSchema, $withFileUrl, true, true);
    }

    /**
     * @return array{
     *     agent: null|SuperMagicAgentEntity,
     *     skills: array<int, SkillEntity|SkillVersionEntity>,
     *     is_store_offline: null|bool
     * }
     */
    public function showLatestVersion(Authenticatable $authorization, string $code, bool $withToolSchema, bool $withFileUrl = false): array
    {
        return $this->showLatestVersionWithAccessMode($authorization, $code, $withToolSchema, $withFileUrl, false);
    }

    public function showLatestVersionUsable(Authenticatable $authorization, string $code, bool $withToolSchema, bool $withFileUrl = false): array
    {
        return $this->showLatestVersionWithAccessMode($authorization, $code, $withToolSchema, $withFileUrl, true);
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
        $query = new SuperMagicAgentQuery();
        $query->setKeyword(trim($requestDTO->getKeyword()));
        $query->setLanguageCode($dataIsolation->getLanguage() ?: LanguageEnum::EN_US->value);
        $query->setCreatorId($dataIsolation->getCurrentUserId());
        $query->setSort($requestDTO->getSort());
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
                'organization_info_map' => [],
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
        $organizationInfoMap = $this->loadAgentOrganizationInfoMap($agents);

        return [
            'agents' => $agents,
            'playbooks_map' => $playbooksMap,
            'agent_market_map' => $agentMarketMap,
            'user_agents_map' => $userAgentsMap,
            'latest_versions_map' => $latestVersionsMap,
            'publisher_user_map' => $publisherUserMap,
            'organization_info_map' => $organizationInfoMap,
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
     *     agent_operations: array<string, Operation>,
     *     latest_versions_map: array<string, AgentVersionEntity>,
     *     publisher_user_map: array<string, MagicUserEntity>,
     *     total: int
     * }
     */
    public function queriesTeamShared(Authenticatable $authorization, QueryAgentsRequestDTO $requestDTO): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $dataIsolation->disabled();

        // 获取团队共享可读的 Agent 编码列表。
        $teamSharedAgentResult = $this->getTeamSharedReadableAgentCodes($dataIsolation);
        return $this->querySharedAgentsByCodes(
            $dataIsolation,
            $requestDTO,
            $teamSharedAgentResult['codes'],
            $teamSharedAgentResult['operations']
        );
    }

    /**
     * 查询“我参与协作的员工”列表。
     *
     * 仅由 operation_permissions 决定展示资格；市场雇佣和货架可见性不会改变结果。
     *
     * @return array{
     *     agents: array<int, SuperMagicAgentEntity>,
     *     playbooks_map: array<string, array<int, AgentPlaybookEntity>>,
     *     agent_market_map: array<string, AgentMarketEntity>,
     *     user_agents_map: array<string, UserAgentEntity>,
     *     agent_operations: array<string, Operation>,
     *     latest_versions_map: array<string, AgentVersionEntity>,
     *     publisher_user_map: array<string, MagicUserEntity>,
     *     total: int
     * }
     */
    public function queriesCollaborated(Authenticatable $authorization, QueryAgentsRequestDTO $requestDTO): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $dataIsolation->disabled();

        $collaboratedAgentResult = $this->getCollaboratedAgentCodes($dataIsolation);
        return $this->querySharedAgentsByCodes(
            $dataIsolation,
            $requestDTO,
            $collaboratedAgentResult['codes'],
            $collaboratedAgentResult['operations']
        );
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
        $marketCodes = $this->getMarketInstalledAgentCodes($dataIsolation);
        $officialCodes = $this->getOfficialAgentCodes($authorization);
        $queryCodes = array_values(array_unique(array_merge($marketCodes, $officialCodes)));

        return $this->queryPublishedVisibleAgentsByCodes($dataIsolation, $requestDTO, $queryCodes, true);
    }

    /**
     * Batch-load the data required to resolve list origins without per-item queries.
     *
     * @param array<string, UserAgentEntity> $userAgentsMap
     * @return array{official_agent_codes: string[], market_source_map: array<int, AgentMarketEntity>}
     */
    public function getAgentListOriginData(Authenticatable $authorization, array $userAgentsMap): array
    {
        $marketIds = [];
        foreach ($userAgentsMap as $userAgent) {
            if ($userAgent->getSourceType()->isMarket() && $userAgent->getSourceId() !== null) {
                $marketIds[] = $userAgent->getSourceId();
            }
        }

        return [
            'official_agent_codes' => $this->getOfficialAgentCodes($authorization),
            'market_source_map' => $this->superMagicAgentDomainService->getStoreAgentsByIds($marketIds),
        ];
    }

    /**
     * 获取当前用户可用的已发布员工列表.
     *
     * @return array{total: int, list: array<int, array{code: string, name: string, description: string}>}
     */
    public function getMyAvailableAgents(Authenticatable $authorization, GetMyAvailableAgentsRequestDTO $requestDTO): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $availableCodes = $this->getUsableAgentCodes($dataIsolation)['codes'];
        if ($availableCodes === []) {
            return [
                'total' => 0,
                'list' => [],
            ];
        }

        $language = $dataIsolation->getLanguage() ?: LanguageEnum::ZH_CN->value;
        $versionQuery = new AgentVersionQuery();
        $versionQuery->setCodes($availableCodes);
        $versionQuery->setPublishedOnly(true);
        $versionQuery->setIsCurrentVersions(true);
        $versionQuery->setLanguageCode($language);
        $versionQuery->setKeywords($requestDTO->getKeywords());

        $dataIsolation->disabled();
        $result = $this->superMagicAgentVersionDomainService->queries(
            $dataIsolation,
            $versionQuery,
            new Page($requestDTO->getPage(), $requestDTO->getPageSize())
        );

        $fallbackAgents = $this->loadAgentVersionTextFallbackAgents($dataIsolation, $result['list'], $language);
        $list = array_map(
            fn (AgentVersionEntity $version): array => $this->buildAvailableAgentItem(
                $version,
                $language,
                $fallbackAgents[$version->getCode()] ?? null
            ),
            $result['list']
        );

        return [
            'total' => $result['total'],
            'list' => $list,
        ];
    }

    /**
     * 统一查询智能体列表。
     */
    public function queryList(Authenticatable $authorization, QueryAgentListRequestDTO $requestDTO): array
    {
        $scope = $requestDTO->getScope();
        if ($scope !== AgentListScope::ALL) {
            return $this->normalizeAgentListResult(match ($scope) {
                AgentListScope::CREATED => $this->queriesCreated($authorization, $requestDTO),
                AgentListScope::TEAM_SHARED => $this->queriesTeamShared($authorization, $requestDTO),
                AgentListScope::COLLABORATED => $this->queriesCollaborated($authorization, $requestDTO),
                AgentListScope::MARKET_INSTALLED => $this->queriesMarketInstalled($authorization, $requestDTO),
            });
        }

        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $queryDataIsolation = clone $dataIsolation;
        $queryDataIsolation->disabled();

        $codes = $this->getUsableAgentCodes($dataIsolation)['codes'];

        if ($codes === []) {
            return $this->buildAgentListResult($dataIsolation, [], [], [], 0);
        }

        $query = (new SuperMagicAgentQuery())->setCodes($codes);
        $query->setKeyword(trim($requestDTO->getKeyword()));
        $query->setLanguageCode($dataIsolation->getLanguage() ?: LanguageEnum::EN_US->value);
        $query->setSort($requestDTO->getSort());

        $result = $this->superMagicAgentDomainService->queries(
            $queryDataIsolation,
            $query,
            new Page($requestDTO->getPage(), $requestDTO->getPageSize())
        );
        $agents = $result['list'];
        if ($agents === []) {
            return $this->buildAgentListResult($dataIsolation, [], [], [], $result['total']);
        }

        $agentCodes = array_map(static fn (SuperMagicAgentEntity $agent): string => $agent->getCode(), $agents);
        $agentCodeMap = array_fill_keys($agentCodes, true);
        $readableAgentResult = $this->getAccessibleAgentCodes($dataIsolation, $dataIsolation->getCurrentUserId());
        $agentOperations = array_intersect_key($readableAgentResult['operations'], $agentCodeMap);
        $latestVersionsMap = $this->superMagicAgentVersionDomainService->getCurrentOrLatestByCodes(
            $queryDataIsolation,
            $agentCodes
        );

        return $this->buildAgentListResult($dataIsolation, $agents, $agentOperations, $latestVersionsMap, $result['total']);
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

        // 排序页的数据源由两部分组成：
        // 1. 当前用户可见的 agent
        // 2. 官方 agent
        // 后续所有排序逻辑都只基于这份“当前有效集合”进行补齐。
        $queryCodes = $this->getUsableAgentCodes($dataIsolation)['codes'];
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

        $officialCodes = $this->getOfficialAgentCodes($dataIsolation);
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
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $codes = $this->normalizeOrderCodes($codes);
        $usableCodes = array_fill_keys(
            $this->getUsableAgentCodes($dataIsolation)['codes'],
            true
        );
        foreach ($codes as $code) {
            if (! isset($usableCodes[$code])) {
                ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'super_magic.agent.agent_not_available');
            }
        }

        $orderConfig = $this->getOrderConfig($authorization) ?? [];
        $frequentCodes = $this->normalizeOrderCodes($orderConfig['frequent'] ?? []);
        $allCodes = $this->normalizeOrderCodes($orderConfig['all'] ?? []);

        foreach ($codes as $code) {
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
                'organization_info_map' => [],
                'total' => 0,
            ];
        }

        $versionQuery = new AgentVersionQuery();
        $versionQuery->setCodes($queryCodes);
        $versionQuery->setKeyword(trim($requestDTO->getKeyword()));
        $versionQuery->setLanguageCode($dataIsolation->getLanguage() ?: LanguageEnum::EN_US->value);
        $versionQuery->setPublishedOnly(true);
        $versionQuery->setSort($requestDTO->getSort());

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
                'organization_info_map' => [],
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
        $organizationInfoMap = $this->loadAgentOrganizationInfoMap($agents);

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
            'organization_info_map' => $organizationInfoMap,
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
        $this->assertAgentEditable($dataIsolation, $code);

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
     * Resolve employee dependency access only after checking use/edit permission.
     *
     * @return string[]
     */
    public function getDownloadableBoundSkillCodes(Authenticatable $authorization, string $code, bool $draft = false): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        if ($draft) {
            // Unpublished dependencies are only available to employee editors.
            $this->assertAgentEditable($dataIsolation, $code);
            $dataIsolation->disabled();
            $bindings = $this->superMagicAgentSkillDomainService->getByAgentCodeForCurrentVersion($dataIsolation, $code);
        } else {
            $this->assertAgentUsable($dataIsolation, $code);
            // Authorization above is mandatory before crossing organization boundaries.
            $dataIsolation->disabled();
            $versions = $this->superMagicAgentVersionDomainService->getLatestPublishedByCodes($dataIsolation, [$code]);
            $version = $versions[$code] ?? null;
            $bindings = $version?->getId() === null ? [] : $this->superMagicAgentSkillDomainService->getByAgentVersionId($dataIsolation, (int) $version->getId());
        }

        return array_values(array_unique(array_map(static fn (AgentSkillEntity $binding): string => $binding->getSkillCode(), $bindings)));
    }

    /**
     * 新增员工绑定的技能（增量添加）.
     */
    public function addAgentSkills(Authenticatable $authorization, string $code, array $skillCodes): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // Verify the caller owns the agent
        $this->assertAgentEditable($dataIsolation, $code);

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
        $this->assertAgentEditable($dataIsolation, $agentCode);

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
     * - `MARKET` 提交审核时不改权限，审核通过后由后台审核应用服务切换为市场可见范围
     * - 一旦从市场重新切回组织内范围，需要将市场状态下线，并重建当前 Agent 的可见范围
     */
    public function publishAgent(Authenticatable $authorization, string $code, PublishAgentRequestDTO $requestDTO): PublishAgentResultDTO
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // Verify the caller owns the agent
        $this->assertAgentEditable($dataIsolation, $code);

        // 1. 查询员工基础信息（校验权限和来源类型）
        $agentEntity = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $code);

        $versionEntity = new AgentVersionEntity();
        if ($requestDTO->getPublishTargetType() === PublishTargetType::MARKET->value) {
            $categoryIds = $requestDTO->getCategoryIds();
            $this->superMagicAgentCategoryDomainService->assertIdsExist($categoryIds);
            $versionEntity->setCategoryIds($categoryIds);
        }

        $versionEntity->setCode($code);
        $versionEntity->setVersion($requestDTO->getVersion());
        $versionEntity->setVersionDescriptionI18n($requestDTO->getVersionDescriptionI18n() ?? []);
        $versionEntity->setPublishTargetType($requestDTO->getPublishTargetType());
        $versionEntity->setPublishTargetValue($requestDTO->toPublishTargetValue());

        return $this->publishPreparedAgentVersion($authorization, $dataIsolation, $code, $agentEntity, $versionEntity, true);
    }

    /** 创建异步 Agent 发布任务。 */
    public function createAsyncPublishAgent(Authenticatable $authorization, string $code, PublishAgentRequestDTO $requestDTO): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $this->assertAgentEditable($dataIsolation, $code);
        $agentEntity = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $code);

        if ($requestDTO->getPublishTargetType() === PublishTargetType::MARKET->value) {
            $this->superMagicAgentCategoryDomainService->assertIdsExist($requestDTO->getCategoryIds());
        }
        $projectId = $agentEntity->getProjectId();
        if (empty($projectId)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'super_magic.agent.export_failed');
        }
        $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
        if ($projectEntity === null) {
            ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'project.project_not_found');
        }
        [$excludePaths, $skillsMdHash] = $this->preparePublishSkillReferences($dataIsolation, $code, $projectId, $projectEntity);
        $sourcePath = $this->resolvePublishExportSourcePath($projectId);
        $this->validateIdentityMdExists($projectId);

        // 同一版本已有发布中任务时复用版本和任务状态，避免重复创建版本。
        $reusedVersion = null;
        $existingVersions = $this->superMagicAgentVersionDomainService->queriesByCode($dataIsolation, $code, null, null, Page::createNoPage(), includePublishing: true)['list'];
        foreach ($existingVersions as $existingVersion) {
            if ($existingVersion->getVersion() === $requestDTO->getVersion()
                && $existingVersion->getPublisherUserId() === $dataIsolation->getCurrentUserId()
                && $existingVersion->getPublishStatus()->isPublishing()
                && $existingVersion->getId() !== null
            ) {
                $existingTaskId = (string) $existingVersion->getId();
                $existingStatus = $this->publishAsyncStatusManager->get($existingTaskId);
                if ($existingStatus !== null && ($existingStatus['status'] ?? '') !== 'failed') {
                    return $existingStatus;
                }
                if ($existingStatus !== null) {
                    $this->publishAsyncStatusManager->update($existingTaskId, ['status' => 'processing', 'progress' => 0, 'file_key' => null, 'error' => null]);
                }
                $reusedVersion = $existingVersion;
                break;
            }
        }

        $versionEntity = $reusedVersion ?? new AgentVersionEntity();
        if ($reusedVersion === null) {
            $versionEntity->setCode($code);
            $versionEntity->setVersion($requestDTO->getVersion());
            $versionEntity->setVersionDescriptionI18n($requestDTO->getVersionDescriptionI18n() ?? []);
            $versionEntity->setPublishTargetType($requestDTO->getPublishTargetType());
            $versionEntity->setPublishTargetValue($requestDTO->toPublishTargetValue());
            if ($requestDTO->getPublishTargetType() === PublishTargetType::MARKET->value) {
                $versionEntity->setCategoryIds($requestDTO->getCategoryIds());
            }

            Db::beginTransaction();
            try {
                $versionEntity = $this->superMagicAgentVersionDomainService->publishAgent($dataIsolation, $agentEntity, $versionEntity, true);
                if ($versionEntity->getId() !== null) {
                    $this->superMagicAgentCategoryRelationDomainService->replaceVersionCategories($dataIsolation, $versionEntity->getId(), $versionEntity->getCategoryIds());
                }
                Db::commit();
            } catch (Throwable $e) {
                Db::rollBack();
                throw $e;
            }
        }

        $taskId = (string) ($versionEntity->getId() ?? IdGenerator::getUniqueId32());
        $taskKey = 'publish:agent:' . $taskId;
        $this->publishAsyncStatusManager->initialize($taskId, [
            'resource_type' => 'agent', 'resource_code' => $code,
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'publisher_user_id' => $dataIsolation->getCurrentUserId(),
            'version_id' => $versionEntity->getId(), 'task_key' => $taskKey,
        ]);
        try {
            $sandboxId = $this->initializeAgentPublishSandbox($dataIsolation, $code, $projectEntity);
            $result = $this->superMagicAgentDomainService->createAgentWorkspaceExportAsync(
                $dataIsolation,
                $code,
                $sandboxId,
                $sourcePath ?? '',
                $code . '_' . $taskId . '.zip',
                $taskKey,
                $this->createContactDataIsolationByBase($dataIsolation),
                $excludePaths,
                $skillsMdHash
            );
            $this->publishAsyncStatusManager->update($taskId, ['sandbox_id' => $sandboxId, 'task_key' => $taskKey]);
            if (($result['status'] ?? '') === 'FAILED' || (($result['code'] ?? 1000) !== 1000 && ($result['code'] ?? -1) !== 4000)) {
                throw new RuntimeException((string) ($result['message'] ?? 'sandbox export failed'));
            }
        } catch (Throwable $e) {
            $this->logger->error('异步 Agent 发布失败', ['task_id' => $taskId, 'error' => $e->getMessage()]);
            $this->publishAsyncStatusManager->update($taskId, ['status' => 'failed', 'error' => '发布任务执行失败，请重新发起发布']);
        }
        return $this->publishAsyncStatusManager->get($taskId) ?? ['publish_task_id' => $taskId, 'status' => 'processing'];
    }

    /** 查询并推进异步 Agent 发布任务。 */
    public function checkAsyncPublishAgent(Authenticatable $authorization, string $code, string $taskId): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $this->assertAgentEditable($dataIsolation, $code);
        $status = $this->publishAsyncStatusManager->get($taskId);
        if ($status === null) {
            $version = $this->superMagicAgentVersionDomainService->findByIdWithoutOrganizationFilter((int) $taskId);
            if ($version !== null
                && $version->getCode() === $code
                && $version->getOrganizationCode() === $dataIsolation->getCurrentOrganizationCode()
                && $version->getPublisherUserId() === $dataIsolation->getCurrentUserId()
                && $version->getPublishStatus()->isPublished()
                && $version->getFileKey() !== null
            ) {
                return ['publish_task_id' => $taskId, 'status' => 'ready', 'progress' => 100, 'file_key' => $version->getFileKey()];
            }
        }
        if ($status === null || ($status['resource_type'] ?? '') !== 'agent' || ($status['resource_code'] ?? '') !== $code
            || ($status['organization_code'] ?? '') !== $dataIsolation->getCurrentOrganizationCode()
            || ($status['publisher_user_id'] ?? '') !== $dataIsolation->getCurrentUserId()) {
            return ['publish_task_id' => $taskId, 'status' => 'failed', 'error' => '发布任务不存在或已过期'];
        }
        if (in_array($status['status'] ?? '', ['ready', 'failed'], true)) {
            return $status;
        }
        if (empty($status['sandbox_id'])) {
            return $status;
        }
        $sandboxId = (string) ($status['sandbox_id'] ?? '');
        $taskKey = (string) ($status['task_key'] ?? ('publish:agent:' . $taskId));
        if ($sandboxId === '') {
            return $status;
        }
        try {
            $result = $this->superMagicAgentDomainService->checkAgentWorkspaceExportAsync($dataIsolation, $sandboxId, $taskKey, contactDataIsolation: $this->createContactDataIsolationByBase($dataIsolation));
            $sandboxStatus = strtoupper((string) ($result['status'] ?? ''));
            if (($result['code'] ?? 1000) === 4004 || $sandboxStatus === 'FAILED') {
                $this->publishAsyncStatusManager->update($taskId, ['status' => 'failed', 'error' => (string) ($result['message'] ?? 'sandbox export failed')]);
            } elseif (in_array($sandboxStatus, ['COMPLETED', 'SUCCESS'], true) && ($result['file_key'] ?? '') !== '') {
                Db::beginTransaction();
                try {
                    $previousVersion = $this->superMagicAgentVersionDomainService->getCurrentVersionByCodeForUpdate($dataIsolation, $code);
                    $version = $this->superMagicAgentVersionDomainService->finalizePreparedAgent($dataIsolation, (int) $status['version_id'], (string) $result['file_key']);
                    $agent = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $code);
                    $agent->setFileKey((string) $result['file_key']);
                    $this->superMagicAgentDomainService->save($dataIsolation, $agent, false);
                    if ($version->getPublishStatus()->isPublished()) {
                        $this->syncAgentPublishScopeTransition($dataIsolation, $agent, $previousVersion, $version);
                    }
                    Db::commit();
                } catch (Throwable $e) {
                    Db::rollBack();
                    throw $e;
                }
                $this->publishAsyncStatusManager->update($taskId, ['status' => 'ready', 'progress' => 100, 'file_key' => $result['file_key']]);
            } else {
                $this->publishAsyncStatusManager->update($taskId, ['progress' => (int) ($result['progress'] ?? $status['progress'] ?? 0)]);
            }
        } catch (Throwable $e) {
            $this->logger->error('异步 Agent 发布检查失败', ['task_id' => $taskId, 'error' => $e->getMessage()]);
            $this->publishAsyncStatusManager->update($taskId, ['status' => 'failed', 'error' => '发布任务检查失败，请重新发起发布']);
        }
        return $this->publishAsyncStatusManager->get($taskId) ?? $status;
    }

    /**
     * 命令补发场景：不导出项目文件，直接以空 file_key 发布到私人范围.
     */
    public function publishAgentPrivatelyWithoutExport(Authenticatable $authorization, string $code): AgentVersionEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        $this->assertAgentEditable($dataIsolation, $code);

        $agentEntity = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $code);
        $agentEntity->hydrateI18nForPublish();

        $versionEntity = new AgentVersionEntity();
        $versionEntity->setCode($code);
        $versionEntity->setVersion(sprintf(
            '%d.0.0',
            $this->superMagicAgentVersionDomainService->countVersionsByCode($dataIsolation, $code) + 1
        ));
        $versionEntity->setVersionDescriptionI18n($agentEntity->getDescriptionI18n() ?? []);
        $versionEntity->setPublishTargetType(PublishTargetType::PRIVATE);
        $versionEntity->setPublishTargetValue(null);

        return $this->publishPreparedAgentVersion($authorization, $dataIsolation, $code, $agentEntity, $versionEntity, false)->version;
    }

    /**
     * 发布表单预填：版本号规则与 Skill 一致；发布范围取自按 created_at 最新一条版本；无版本时 publish_target 为 null.
     */
    public function getPublishPrefill(Authenticatable $authorization, string $code): AgentPublishPrefillResponseDTO
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        $this->assertAgentEditable($dataIsolation, $code);

        $agentEntity = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $code);

        $descriptionI18n = $agentEntity->getDescriptionI18n();
        $versionDescriptionI18n = is_array($descriptionI18n) ? $descriptionI18n : [];

        $latestVersion = $this->superMagicAgentVersionDomainService->findLatestVersionByCreatedAt($dataIsolation, $code);
        $version = $this->superMagicAgentVersionDomainService->getNextAvailableVersion(
            $dataIsolation,
            $code,
            $latestVersion?->getVersion(),
        );
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
            categoryIds: $latestVersion === null || $latestVersion->getId() === null
                ? []
                : $this->superMagicAgentCategoryRelationDomainService->getVersionCategoryIds(
                    $latestVersion->getId(),
                ),
        );
    }

    /**
     * @return array{
     *     list: array<int, AgentVersionEntity>,
     *     page: int,
     *     page_size: int,
     *     total: int,
     *     userMap: array<string, MagicUserEntity>,
     *     memberDepartmentMap: array<string, MagicDepartmentEntity>,
     *     categoryMap: array<int, AgentCategoryEntity>
     * }
     */
    public function queryVersions(Authenticatable $authorization, string $code, QueryAgentVersionsRequestDTO $requestDTO): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 版本查看属于只读操作，具有 read / editor / admin / owner 权限的协作者均可访问；
        // 内置 Agent（官方 Mode）等白名单场景由 assertAgentReadable 内部自行兜底放行。
        $this->assertAgentReadable($dataIsolation, $code);

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
        $this->fillVersionCategoryIds($versions);
        [$userMap, $memberDepartmentMap] = $this->batchLoadAgentVersionRelatedEntities(
            $dataIsolation->getCurrentOrganizationCode(),
            $versions
        );
        $categoryMap = $this->loadAgentCategoryMap($versions);

        return [
            'list' => $versions,
            'page' => $requestDTO->getPage(),
            'page_size' => $requestDTO->getPageSize(),
            'total' => $result['total'],
            'userMap' => $userMap,
            'memberDepartmentMap' => $memberDepartmentMap,
            'categoryMap' => $categoryMap,
        ];
    }

    public function touchUpdatedAt(Authenticatable $authorization, string $code): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 检查权限
        $this->assertAgentEditable($dataIsolation, $code);

        $this->superMagicAgentDomainService->updateUpdatedAtByCode($dataIsolation, $code);
    }

    /**
     * 我的技能列表，包含系统技能 + 当前数字员工技能 + 我的技能列表。
     *
     * @return array<int, array{id: string, code: string, name: string, description: string, logo: ?string, mention_source: string}>
     */
    public function getMentionSkills(Authenticatable $authorization, string $employeeCode = ''): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $language = $dataIsolation->getLanguage() ?: LanguageEnum::EN_US->value;

        $result = [];
        $seenCodes = [];
        // 按优先级从高到低合并，命中重复 code 时保留先出现的技能：
        // 系统内置 > 员工可见 > 我的技能
        $mentionSkillGroupsByPriority = [
            $this->buildSystemMentionSkills(),
            $this->buildEmployeeMentionSkills($dataIsolation, $employeeCode, $language),
            $this->buildMineMentionSkills($dataIsolation, $language),
        ];

        foreach ($mentionSkillGroupsByPriority as $mentionSkillGroup) {
            foreach ($mentionSkillGroup as $item) {
                $code = $item['code'];
                if ($code === '' || isset($seenCodes[$code])) {
                    continue;
                }

                $seenCodes[$code] = true;
                $result[] = $item;
            }
        }

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
        $this->assertAgentEditable($dataIsolation, $code);

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

        $usableAgentResult = $this->getUsableAgentCodes($dataIsolation);
        $availableCodes = array_values(array_unique(array_merge($builtinAgentCodes, $usableAgentResult['codes'])));

        // Featured 区也要复用同一套排序补齐规则，避免首页和排序页行为不一致。
        $orderConfig = $this->resolveOrderConfigWithNewAgents(
            $orderConfig,
            $availableCodes,
            $builtinAgentCodes
        );

        $featuredOrderGroups = $this->resolveFeaturedOrderGroups($orderConfig);
        $frequentCodes = $featuredOrderGroups['frequent'];
        $allCodes = $featuredOrderGroups['all'];
        $queryAgentCodes = $configuredCodes = $featuredOrderGroups['query'];

        if ($configuredCodes !== []) {
            // featured 同时返回显示中和隐藏员工，显示状态由排序分组决定。
            $builtinAgents = array_values(array_filter(
                $builtinAgents,
                static fn (SuperMagicAgentEntity $agent): bool => in_array($agent->getCode(), $configuredCodes, true)
            ));
            $builtinAgentCodes = array_map(
                static fn (SuperMagicAgentEntity $agent): string => $agent->getCode(),
                $builtinAgents
            );
        } else {
            // 保留兜底逻辑，避免后续排序规则变更时首页数据直接为空。
            $queryAgentCodes = array_values(array_unique(array_diff(
                array_merge($usableAgentResult['codes'], $builtinAgentCodes),
                $builtinAgentCodes
            )));
        }

        $versionEntities = $this->superMagicAgentVersionDomainService->getLatestPublishedByCodes($dataIsolation, $queryAgentCodes);
        $agentEntities = $this->buildExternalVisibleAgentsFromVersions($dataIsolation, $versionEntities);

        foreach ($agentEntities as $agentEntity) {
            if (in_array($agentEntity->getCode(), $usableAgentResult['codes'], true)) {
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

        $featuredAgentResult = $this->categorizeAgents(
            $result['list'],
            $result['total'],
            [
                'frequent' => $frequentCodes,
                'all' => $allCodes,
            ]
        );

        $featuredAgentResult['playbooks'] = $agentCodeMapPlaybookEntities;
        return $featuredAgentResult;
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
        $this->assertAgentEditable($dataIsolation, $code);

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

        $sandboxId = $this->initializeAgentPublishSandbox($dataIsolation, $code, $project);
        $contactDataIsolation = $this->createContactDataIsolationByBase($dataIsolation);

        return $this->superMagicAgentDomainService->exportAgentFromSandbox(
            $dataIsolation,
            $code,
            $projectId,
            $fullWorkdir,
            $sandboxId,
            $contactDataIsolation,
            null
        );
    }

    /**
     * 删除 Agent。
     *
     * 分两种场景处理：
     * - 市场安装的 Agent：当前用户卸载自己安装的副本，仅移除 user_agent 归属及个人可见性记录。
     * - 自建/协作 Agent：通过协作权限模型判定，具备删除权限的协作者（owner/admin）方可删除。
     */
    public function delete(Authenticatable $authorization, string $code): bool
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 查询当前用户对该 Agent 的 user_agent 归属记录（仅用于判断是否为市场安装场景）
        $userAgentOwnership = $this->userAgentDomainService->findUserAgentOwnershipByCode($dataIsolation, $code);

        if ($userAgentOwnership !== null && $userAgentOwnership->getSourceType()->isMarket()) {
            // 市场安装场景：卸载当前用户的私人副本，不影响其他协作者对该 Agent 的访问
            Db::beginTransaction();
            try {
                $this->userAgentDomainService->deleteUserAgentOwnership($dataIsolation, $code);
                // 卸载后同步清理该用户的个人可见性记录
                $this->removeAgentVisibilityUsers($dataIsolation, $code, [$dataIsolation->getCurrentUserId()]);
                Db::commit();
            } catch (Throwable $throwable) {
                Db::rollBack();
                throw $throwable;
            }
            return true;
        }

        // 自建/协作 Agent：通过协作权限模型判定删除权限（owner 和被授予管理权限的协作者可删除）
        $this->assertAgentDeletable($dataIsolation, $code);

        // 官方组织内置 Agent 不允许删除（与官方 Mode 绑定的 Agent）
        if (OfficialOrganizationUtil::isOfficialOrganization($dataIsolation->getCurrentOrganizationCode())) {
            $modeDataIsolation = $this->createModeDataIsolation($dataIsolation);
            $modeDataIsolation->setOnlyOfficialOrganization(true);
            $mode = $this->modeDomainService->getModeDetailByIdentifier($modeDataIsolation, $code);
            if ($mode !== null) {
                ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'super_magic.agent.official_agent_cannot_delete');
            }
        }

        $offlineMarketId = $this->superMagicAgentMarketDomainService
            ->getByAgentCodeWithoutStatus($code)
            ?->getId();
        Db::beginTransaction();
        try {
            $this->clearAgentVisibility($dataIsolation, $code);
            $this->clearAgentOwnerPermission($dataIsolation, $code);
            $result = $this->superMagicAgentDomainService->delete($dataIsolation, $code);
            Db::commit();
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }

        if ($result) {
            $this->dispatchAgentMarketOfflineEvent($offlineMarketId, $dataIsolation);
        }

        return $result;
    }

    /**
     * 雇用市场员工（从市场添加到用户员工列表）.
     */
    public function hireAgent(Authenticatable $authorization, string $agentMarketCode): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        Db::beginTransaction();
        try {
            $permissionIsolation = $this->createPermissionDataIsolation($dataIsolation);
            $marketEntity = $this->superMagicAgentMarketDomainService->getPublishedByAgentCodeForUpdate(
                $permissionIsolation->getCurrentOrganizationCode(),
                $agentMarketCode
            );
            if ($marketEntity === null) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $agentMarketCode]);
            }
            $this->assertMarketDiscoverableForUser(
                $permissionIsolation,
                $marketEntity,
                $dataIsolation->getCurrentUserId()
            );
            if ($this->userAgentDomainService->findUserAgentOwnershipByCode($dataIsolation, $agentMarketCode) !== null) {
                ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'super_magic.agent.store_agent_already_added');
            }

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
     * 获取用户可访问的技能代码.
     *
     * @param array<string> $skillCodes
     * @return array<string>
     */
    protected function getAccessibleSkillCodesWithBuiltinFallback(SuperMagicAgentDataIsolation $dataIsolation, ?array $skillCodes = null): array
    {
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        $accessibleSkillCodes = $this->resourceVisibilityDomainService->getUserAccessibleResourceCodes(
            $permissionDataIsolation,
            $dataIsolation->getCurrentUserId(),
            ResourceVisibilityResourceType::SKILL,
            $skillCodes
        );

        return array_values(array_unique(array_merge(
            $accessibleSkillCodes,
            $this->skillMarketDomainService->getPublishedSkillCodes($skillCodes ?? []),
            array_values(array_intersect(
                $this->skillMarketDomainService->getOfficialBuiltinSkillCodes(),
                $skillCodes ?? []
            ))
        )));
    }

    private function dispatchAgentMarketOfflineEvent(
        ?int $marketId,
        SuperMagicAgentDataIsolation $dataIsolation,
    ): void {
        if ($marketId === null) {
            return;
        }

        AsyncEventUtil::dispatch(new AgentMarketOfflineEvent(
            (string) $marketId,
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
        ));
    }

    /**
     * 按可读员工编码统一组装协作类列表，避免团队共享和协作列表出现查询语义漂移。
     *
     * @param array<string> $queryCodes
     * @param array<string, Operation> $agentOperations
     */
    private function querySharedAgentsByCodes(
        SuperMagicAgentDataIsolation $dataIsolation,
        QueryAgentsRequestDTO $requestDTO,
        array $queryCodes,
        array $agentOperations
    ): array {
        if ($queryCodes === []) {
            return [
                'agents' => [],
                'playbooks_map' => [],
                'agent_market_map' => [],
                'user_agents_map' => [],
                'agent_operations' => [],
                'latest_versions_map' => [],
                'publisher_user_map' => [],
                'organization_info_map' => [],
                'total' => 0,
            ];
        }

        $superMagicAgentQuery = (new SuperMagicAgentQuery())->setCodes($queryCodes);
        $superMagicAgentQuery->setKeyword(trim($requestDTO->getKeyword()));
        $superMagicAgentQuery->setLanguageCode($dataIsolation->getLanguage() ?: LanguageEnum::EN_US->value);
        $superMagicAgentQuery->setSort($requestDTO->getSort());
        $versionPage = new Page($requestDTO->getPage(), $requestDTO->getPageSize());
        $agentQueriesResult = $this->superMagicAgentDomainService->queries($dataIsolation, $superMagicAgentQuery, $versionPage);

        if (empty($agentQueriesResult['list'])) {
            return [
                'agents' => [],
                'playbooks_map' => [],
                'agent_market_map' => [],
                'user_agents_map' => [],
                'agent_operations' => [],
                'latest_versions_map' => [],
                'publisher_user_map' => [],
                'organization_info_map' => [],
                'total' => $agentQueriesResult['total'],
            ];
        }
        $agents = $agentQueriesResult['list'];

        // 读取agent的最新发布版本
        $agentQueriesCodes = array_map(static fn (SuperMagicAgentEntity $agent): string => $agent->getCode(), $agents);
        $agentVersionEntities = $this->superMagicAgentVersionDomainService->getLatestPublishedByCodes($dataIsolation, $agentQueriesCodes);

        // 如果是发布内部市场共享的agent，则使用version
        foreach ($agents as $index => $agentEntity) {
            $agentCode = $agentEntity->getCode();
            if (isset($agentOperations[$agentCode])) {
                unset($agentVersionEntities[$agentCode]);
                continue;
            }
            $agentVersionEntity = $agentVersionEntities[$agentCode] ?? null;
            if (! $agentVersionEntity) {
                continue;
            }
            $agents[$index] = $this->buildExternalVisibleAgentsFromVersions($dataIsolation, [$agentCode => $agentVersionEntity])[0];
        }
        $this->updateAgentEntitiesIcon($agents);

        $agentCodes = array_map(static fn (SuperMagicAgentEntity $agent): string => $agent->getCode(), $agents);
        $playbooksMap = $this->superMagicAgentPlaybookDomainService->getByAgentCodesForCurrentVersion($dataIsolation, $agentCodes, true);
        $agentMarketMap = $this->superMagicAgentDomainService->getStoreAgentsByAgentCodes($agentCodes);
        $userAgentsMap = $this->userAgentDomainService->findUserAgentOwnershipsByCodes($dataIsolation, $agentCodes);
        $publisherUserMap = $this->loadAgentPublisherUserMap($agents);
        $organizationInfoMap = $this->loadAgentOrganizationInfoMap($agents);

        return [
            'agents' => $agents,
            'playbooks_map' => $playbooksMap,
            'agent_market_map' => $agentMarketMap,
            'user_agents_map' => $userAgentsMap,
            'agent_operations' => $agentOperations,
            'latest_versions_map' => $agentVersionEntities,
            'publisher_user_map' => $publisherUserMap,
            'organization_info_map' => $organizationInfoMap,
            'total' => $agentQueriesResult['total'],
        ];
    }

    private function showWithAccessMode(
        Authenticatable $authorization,
        string $code,
        bool $withToolSchema,
        bool $withFileUrl,
        bool $checkPermission,
        bool $usableOnly
    ): array {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $flowDataIsolation = $this->createFlowDataIsolation($authorization);

        $operation = $usableOnly
            ? null
            : $this->assertAgentDetailReadable($dataIsolation, $code);
        if ($usableOnly) {
            $this->assertAgentUsable($dataIsolation, $code);
        }
        // 权限断言通过后关闭组织过滤，支持协作者读取非本人创建的 Agent
        $dataIsolation->disabled();

        // 1. 查询 Agent 详情（包含技能列表和 Playbook 列表）
        $agent = $this->superMagicAgentDomainService->getDetail($dataIsolation, $code);
        // 2. 加载tool
        if ($withToolSchema) {
            $this->hydrateToolSchemas($agent, $flowDataIsolation);
        }

        // 3. 批量查询技能详情
        $agentSkills = $agent->getSkills();
        $skillCodes = array_map(fn ($agentSkill) => $agentSkill->getSkillCode(), $agentSkills);
        $skillDataIsolation = new SkillDataIsolation();
        $skillDataIsolation->extends($dataIsolation);
        $skillDataIsolation->disabled();
        $skillsMap = $this->skillVersionDomainService->findSkillCurrentOrLatestByCodes($skillDataIsolation, $skillCodes);

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
            'operation' => $operation,
        ];
    }

    private function showLatestVersionWithAccessMode(
        Authenticatable $authorization,
        string $code,
        bool $withToolSchema,
        bool $withFileUrl,
        bool $usableOnly
    ): array {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $flowDataIsolation = $this->createFlowDataIsolation($authorization);

        if ($usableOnly) {
            $this->assertAgentUsable($dataIsolation, $code);
        } else {
            $this->assertAgentDetailReadable($dataIsolation, $code);
        }
        $dataIsolation->disabled();
        $versionEntity = $this->superMagicAgentVersionDomainService->getCurrentOrLatestByCode($dataIsolation, $code);
        if ($versionEntity === null) {
            return [
                'agent' => null,
                'skills' => [],
                'is_store_offline' => false,
            ];
        }

        $agent = $this->buildAgentDetailFromVersion($versionEntity);
        if ($withToolSchema) {
            $this->hydrateToolSchemas($agent, $flowDataIsolation);
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
        $skillsMap = $this->skillVersionDomainService->findSkillCurrentOrLatestByCodes($skillDataIsolation, $skillCodes);

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
        ];
    }

    /**
     * @param AgentVersionEntity[] $versions
     * @return array<int, AgentCategoryEntity>
     */
    private function loadAgentCategoryMap(array $versions): array
    {
        $categoryIds = [];
        foreach ($versions as $version) {
            $categoryIds = array_merge($categoryIds, $version->getCategoryIds());
        }

        $categoryIds = array_values(array_unique($categoryIds));
        if ($categoryIds === []) {
            return [];
        }

        $categories = $this->superMagicAgentCategoryDomainService->findByIds($categoryIds);
        $categoryMap = [];
        foreach ($categories as $category) {
            if ($category->getId() === null) {
                continue;
            }
            $categoryMap[$category->getId()] = $category;
        }

        return $categoryMap;
    }

    /** @param AgentVersionEntity[] $versions */
    private function fillVersionCategoryIds(array $versions): void
    {
        $versionIds = [];
        foreach ($versions as $version) {
            if ($version->getId() !== null) {
                $versionIds[] = $version->getId();
            }
        }

        $categoryIdsMap = $this->superMagicAgentCategoryRelationDomainService->getVersionCategoryIdsMap($versionIds);
        foreach ($versions as $version) {
            $versionId = $version->getId();
            if ($versionId === null) {
                continue;
            }

            $version->setCategoryIds($categoryIdsMap[$versionId] ?? []);
        }
    }

    /**
     * @return array{code: string, name: string, description: string}
     */
    private function buildAvailableAgentItem(
        AgentVersionEntity $versionEntity,
        string $language,
        ?SuperMagicAgentEntity $fallbackAgent = null
    ): array {
        return [
            'code' => $versionEntity->getCode(),
            'name' => $this->resolveAgentVersionName($versionEntity, $language, $fallbackAgent),
            'description' => $this->resolveAgentVersionDescription($versionEntity, $language, $fallbackAgent),
        ];
    }

    /**
     * @param array<AgentVersionEntity> $versionEntities
     * @return array<string, SuperMagicAgentEntity>
     */
    private function loadAgentVersionTextFallbackAgents(
        SuperMagicAgentDataIsolation $dataIsolation,
        array $versionEntities,
        string $language
    ): array {
        $fallbackCodes = [];
        foreach ($versionEntities as $versionEntity) {
            if ($versionEntity->getI18nName($language) === '' || $versionEntity->getI18nDescription($language) === '') {
                $fallbackCodes[] = $versionEntity->getCode();
            }
        }

        $fallbackCodes = array_values(array_unique($fallbackCodes));
        return $fallbackCodes === []
            ? []
            : $this->superMagicAgentDomainService->findByCodes($dataIsolation, $fallbackCodes);
    }

    private function resolveAgentVersionName(
        AgentVersionEntity $versionEntity,
        string $language,
        ?SuperMagicAgentEntity $fallbackAgent
    ): string {
        $name = $versionEntity->getI18nName($language);
        if ($name === '' && $fallbackAgent !== null) {
            return $fallbackAgent->getI18nName($language);
        }

        return $name;
    }

    private function resolveAgentVersionDescription(
        AgentVersionEntity $versionEntity,
        string $language,
        ?SuperMagicAgentEntity $fallbackAgent
    ): string {
        $description = $versionEntity->getI18nDescription($language);
        if ($description === '' && $fallbackAgent !== null) {
            return $fallbackAgent->getI18nDescription($language);
        }

        return $description;
    }

    private function hydrateToolSchemas(SuperMagicAgentEntity $agent, mixed $flowDataIsolation): void
    {
        $agent->setTools($agent->getTools());

        $remoteToolCodes = [];
        foreach ($agent->getTools() as $tool) {
            if (! $tool->getType()->isRemote()) {
                continue;
            }
            if ($this->isKnowledgeSearchTool($tool->getCode())) {
                continue;
            }
            $remoteToolCodes[] = $tool->getCode();
        }

        $remoteTools = ToolsExecutor::getToolFlows($flowDataIsolation, $remoteToolCodes, true);
        foreach ($agent->getTools() as $tool) {
            if ($this->isKnowledgeSearchTool($tool->getCode())) {
                $tool->setSchema($this->buildKnowledgeSearchToolSchema());
                continue;
            }
            $remoteTool = $remoteTools[$tool->getCode()] ?? null;
            if ($remoteTool) {
                $tool->setSchema($remoteTool->getInput()->getForm()?->getForm()->toJsonSchema());
            }
        }
    }

    private function isKnowledgeSearchTool(string $toolCode): bool
    {
        return $toolCode === self::KNOWLEDGE_SEARCH_TOOL_CODE;
    }

    private function buildKnowledgeSearchToolSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'query' => [
                    'type' => 'string',
                    'description' => '用于检索相关知识上下文的查询语句。',
                ],
            ],
            'required' => ['query'],
            'additionalProperties' => false,
        ];
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
                'organization_info_map' => [],
                'total' => 0,
            ];
        }

        $versionQuery = new AgentVersionQuery();
        $versionQuery->setCodes($queryCodes);
        $versionQuery->setKeyword(trim($requestDTO->getKeyword()));
        $versionQuery->setLanguageCode($dataIsolation->getLanguage() ?: LanguageEnum::EN_US->value);
        $versionQuery->setPublishedOnly(true);
        $versionQuery->setSort($requestDTO->getSort());

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
                'organization_info_map' => [],
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
        $organizationInfoMap = $this->loadAgentOrganizationInfoMap($agents);

        return [
            'agents' => $agents,
            'playbooks_map' => $playbooksMap,
            'agent_market_map' => $agentMarketMap,
            'user_agents_map' => $userAgentOwnershipMap,
            'latest_versions_map' => $currentVersionsMap,
            'publisher_user_map' => $publisherUserMap,
            'organization_info_map' => $organizationInfoMap,
            'total' => $versionQueryResult['total'],
        ];
    }

    /**
     * 统一补齐列表结果字段，便于 queryList 直接复用现有分组查询。
     */
    private function normalizeAgentListResult(array $result): array
    {
        $publisherUserMap = $result['publisher_user_map'] ?? [];

        return [
            'agents' => $result['agents'],
            'playbooks_map' => $result['playbooks_map'],
            'agent_market_map' => $result['agent_market_map'],
            'user_agents_map' => $result['user_agents_map'] ?? [],
            'agent_operations' => $result['agent_operations'] ?? [],
            'latest_versions_map' => $result['latest_versions_map'],
            'publisher_user_map' => $publisherUserMap,
            'creator_user_map' => $result['creator_user_map'] ?? $publisherUserMap,
            'organization_info_map' => $result['organization_info_map'] ?? [],
            'total' => $result['total'],
        ];
    }

    private function buildAgentListResult(
        SuperMagicAgentDataIsolation $dataIsolation,
        array $agents,
        array $agentOperations,
        array $latestVersionsMap,
        int $total
    ): array {
        $this->updateAgentEntitiesIcon($agents);
        if ($agents === []) {
            return [
                'agents' => [],
                'playbooks_map' => [],
                'agent_market_map' => [],
                'user_agents_map' => [],
                'agent_operations' => [],
                'latest_versions_map' => [],
                'publisher_user_map' => [],
                'creator_user_map' => [],
                'organization_info_map' => [],
                'total' => $total,
            ];
        }

        $queryDataIsolation = clone $dataIsolation;
        $queryDataIsolation->disabled();
        $agentCodes = array_map(static fn (SuperMagicAgentEntity $agent): string => $agent->getCode(), $agents);
        $agentCodeMap = array_fill_keys($agentCodes, true);
        $playbooksMap = $this->superMagicAgentPlaybookDomainService->getByAgentCodesForCurrentVersion(
            $queryDataIsolation,
            $agentCodes,
            true
        );
        $agentMarketMap = $this->superMagicAgentDomainService->getStoreAgentsByAgentCodes($agentCodes);
        $userAgentsMap = $this->userAgentDomainService->findUserAgentOwnershipsByCodes($queryDataIsolation, $agentCodes);
        $userMap = $this->loadAgentPublisherUserMap($agents);
        $organizationInfoMap = $this->loadAgentOrganizationInfoMap($agents);

        return [
            'agents' => $agents,
            'playbooks_map' => $playbooksMap,
            'agent_market_map' => $agentMarketMap,
            'user_agents_map' => $userAgentsMap,
            'agent_operations' => $agentOperations,
            'latest_versions_map' => array_intersect_key($latestVersionsMap, $agentCodeMap),
            'publisher_user_map' => $userMap,
            'creator_user_map' => $userMap,
            'organization_info_map' => $organizationInfoMap,
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
     * @param SuperMagicAgentEntity[] $agents
     * @return array<string, array{name: string}>
     */
    private function loadAgentOrganizationInfoMap(array $agents): array
    {
        $organizationCodes = [];
        foreach ($agents as $agent) {
            $organizationCode = $agent->getOrganizationCode();
            if ($organizationCode !== '') {
                $organizationCodes[] = $organizationCode;
            }
        }

        $organizationCodes = array_values(array_unique($organizationCodes));
        if ($organizationCodes === []) {
            return [];
        }

        /** @var array<string, OrganizationEntity> $organizationMap */
        $organizationMap = $this->organizationDomainService->getByCodes($organizationCodes);
        $organizationInfoMap = [];
        foreach ($organizationCodes as $organizationCode) {
            $organizationInfoMap[$organizationCode] = [
                'name' => ($organizationMap[$organizationCode] ?? null)?->getName() ?: $organizationCode,
            ];
        }

        return $organizationInfoMap;
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
     * @param array{frequent?: array<string>, all?: array<string>} $orderConfig
     * @return array{frequent: array<string>, all: array<string>, query: array<string>}
     */
    private function resolveFeaturedOrderGroups(array $orderConfig): array
    {
        $frequentCodes = $this->normalizeOrderCodes($orderConfig['frequent'] ?? []);
        $frequentCodeSet = array_fill_keys($frequentCodes, true);
        $allCodes = array_values(array_filter(
            $this->normalizeOrderCodes($orderConfig['all'] ?? []),
            static fn (string $code): bool => ! isset($frequentCodeSet[$code])
        ));

        return [
            'frequent' => $frequentCodes,
            'all' => $allCodes,
            'query' => array_merge($frequentCodes, $allCodes),
        ];
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
     * Validate that IDENTITY.md exists in the agent project before publishing.
     */
    private function validateIdentityMdExists(int $projectId): void
    {
        if (! $this->taskFileDomainService->existsStrictAgentIdentityFile($projectId)) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::PUBLISH_IDENTITY_MD_NOT_FOUND,
                'super_magic.agent.publish.identity_md_not_found',
                ['path' => self::REQUIRED_IDENTITY_PATH]
            );
        }
    }

    /**
     * @return array{file_key: string, metadata: array, sandbox_id: string}
     */
    private function exportFileFromProject(
        Authenticatable $authorization,
        string $code,
        int $projectId,
        ?string $sourcePath = null,
        array $excludePaths = [],
        ?string $skillsMdHash = null
    ): array {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // Get project entity to build the full working directory
        $project = $this->projectDomainService->getProjectNotUserId($projectId);
        if (! $project) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        $fullPrefix = $this->taskFileDomainService->getFullPrefix($project->getUserOrganizationCode());
        $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $project->getWorkDir());

        $sandboxId = $this->initializeAgentPublishSandbox($dataIsolation, $code, $project);
        $contactDataIsolation = $this->createContactDataIsolationByBase($dataIsolation);

        $exportResult = $this->superMagicAgentDomainService->exportAgentFromSandbox(
            $dataIsolation,
            $code,
            $projectId,
            $fullWorkdir,
            $sandboxId,
            $contactDataIsolation,
            $sourcePath,
            $excludePaths,
            $skillsMdHash
        );
        $exportResult['sandbox_id'] = $sandboxId;

        return $exportResult;
    }

    private function initializeAgentPublishSandbox(
        SuperMagicAgentDataIsolation $dataIsolation,
        string $agentCode,
        ProjectEntity $projectEntity
    ): string {
        $topicId = $projectEntity->getCurrentTopicId();
        if (empty($topicId)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        $topicEntity = $this->topicDomainService->getTopicById($topicId);
        if ($topicEntity === null || $topicEntity->getProjectId() !== $projectEntity->getId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        $contactDataIsolation = $this->createContactDataIsolationByBase($dataIsolation);

        if ($topicEntity->getAgentCode() !== $agentCode) {
            $this->topicDomainService->updateTopicAgentCode($contactDataIsolation, $topicEntity->getId(), $agentCode);
            $topicEntity->setAgentCode($agentCode);
        }

        $sandboxId = $topicEntity->getSandboxId();
        if ($sandboxId === (string) $topicEntity->getId()) {
            $sandboxId = '';
        }
        $topicEntity->setSandboxId($sandboxId);

        $taskEntity = $this->taskDomainService->initDefaultTask(
            $contactDataIsolation,
            $topicEntity,
            self::AGENT_PUBLISH_EXPORT_TASK_PROMPT
        );

        $agentContext = $this->agentDomainService->buildInitAgentContext(
            dataIsolation: $contactDataIsolation,
            projectEntity: $projectEntity,
            topicEntity: $topicEntity,
            taskEntity: $taskEntity,
            sandboxId: $sandboxId,
            skipInitMessage: true
        );
        $sandboxId = $this->agentDomainService->ensureSandboxInitialized(
            $contactDataIsolation,
            $agentContext,
            // Agent 发布属于工具执行场景，不挂载 .topic 话题目录，只挂 project/user 空间
            new SandboxRootFileIds(
                (string) $this->taskFileDomainService->getProjectRootFileId($projectEntity->getId()),
                (string) $this->taskFileDomainService->findOrCreateUserRootDirectory($contactDataIsolation->getCurrentUserId(), $contactDataIsolation->getCurrentOrganizationCode())
            )
        );

        $this->topicDomainService->updateTopicStatusAndSandboxId(
            $topicEntity->getId(),
            $taskEntity->getId(),
            TaskStatus::FINISHED,
            $sandboxId
        );
        $this->taskDomainService->updateTaskStatus(
            TaskStatus::FINISHED,
            $taskEntity->getId(),
            (string) $taskEntity->getId(),
            $sandboxId
        );

        $this->logger->info('Agent publish sandbox initialized through sandbox pool', [
            'agent_code' => $agentCode,
            'project_id' => $projectEntity->getId(),
            'topic_id' => $topicEntity->getId(),
            'task_id' => $taskEntity->getId(),
            'sandbox_id' => $sandboxId,
        ]);

        return $sandboxId;
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
        $accessibleSkillCodes = $this->getAccessibleSkillCodesWithBuiltinFallback($dataIsolation, $skillCodes);

        $accessibleSkillCodeMap = array_flip($accessibleSkillCodes);
        foreach ($skillCodes as $skillCode) {
            if (! isset($accessibleSkillCodeMap[$skillCode])) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'super_magic.agent.skill_access_denied');
            }
        }

        $skillDataIsolation = new SkillDataIsolation();
        $skillDataIsolation->extends($dataIsolation);
        $skillDataIsolation->disabled();
        $skillVersions = $this->skillVersionDomainService->findSkillCurrentOrLatestByCodes($skillDataIsolation, $skillCodes);
        foreach ($skillCodes as $skillCode) {
            if (! isset($skillVersions[$skillCode])) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'super_magic.agent.skill_version_not_found');
            }
        }

        return $skillVersions;
    }

    /**
     * 构建系统内置技能列表.
     *
     * @return array<int, array{id: string, code: string, name: string, description: string, logo: ?string, mention_source: string}>
     */
    private function buildSystemMentionSkills(): array
    {
        $items = [];
        $language = CoContext::getLanguage() ?: LanguageEnum::EN_US->value;
        foreach ($this->skillMarketDomainService->getOfficialBuiltinSkillEntities() as $builtinSkill) {
            $items[] = [
                'id' => $builtinSkill->getSkillCode(),
                'code' => $builtinSkill->getSkillCode(),
                'name' => $builtinSkill->getI18nName($language),
                'package_name' => $builtinSkill->getPackageName(),
                'description' => $builtinSkill->getI18nDescription($language),
                'logo' => $builtinSkill->getLogo() ?: null,
                'mention_source' => SkillMentionSource::SYSTEM->value,
            ];
        }

        return $items;
    }

    /**
     * 构建员工可见技能列表.
     *
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

        $this->assertAgentUsable($dataIsolation, $employeeCode);

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

        $skillVersionMap = $this->skillVersionDomainService->findSkillVersionsByIdsWithoutOrganizationFilter(
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
     * 构建我的技能列表.
     *
     * @return array<int, array{id: string, code: string, name: string, description: string, logo: ?string, mention_source: string}>
     */
    private function buildMineMentionSkills(SuperMagicAgentDataIsolation $dataIsolation, string $language): array
    {
        $accessibleSkillCodes = $this->getAccessibleSkillCodesWithBuiltinFallback($dataIsolation);

        if ($accessibleSkillCodes === []) {
            return [];
        }

        $skillVersions = $this->skillVersionDomainService->findCurrentSkillVersionsByCodesWithoutOrganizationFilter(
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

    /**
     * 构建技能版本名称.
     */
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

    /**
     * 构建技能版本描述.
     */
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

    /**
     * 构建智能体详情.
     */
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
     * 构建外部可见智能体列表.
     *
     * @param array<string, AgentVersionEntity> $currentVersionsMap
     * @return array<SuperMagicAgentEntity>
     */
    private function buildExternalVisibleAgentsFromVersions(
        SuperMagicAgentDataIsolation $dataIsolation,
        array $currentVersionsMap
    ): array {
        $language = $dataIsolation->getLanguage();
        $fallbackAgents = $this->loadAgentVersionTextFallbackAgents($dataIsolation, $currentVersionsMap, $language);

        $agents = [];
        foreach ($currentVersionsMap as $code => $versionEntity) {
            $fallbackAgent = $fallbackAgents[$code] ?? null;
            $name = $this->resolveAgentVersionName($versionEntity, $language, $fallbackAgent);
            $description = $this->resolveAgentVersionDescription($versionEntity, $language, $fallbackAgent);

            $agent = new SuperMagicAgentEntity();
            $agent->setId($versionEntity->getId());
            $agent->setOrganizationCode($versionEntity->getOrganizationCode());
            $agent->setCode($code);
            $agent->setName($name);
            $agent->setDescription($description);
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
     * 获取官方内置智能体列表.
     *
     * @return array<SuperMagicAgentEntity>
     */
    private function getBuiltinAgent(SuperMagicAgentDataIsolation $superMagicAgentDataIsolation): array
    {
        $modeDataIsolation = $this->createModeDataIsolation($superMagicAgentDataIsolation);
        $modeDataIsolation->setOnlyOfficialOrganization(true);
        $query = new ModeQuery(excludeDefault: true, status: true);
        $modesResult = $this->modeDomainService->getOrganizationVisibleModes($modeDataIsolation, $query, Page::createNoPage());

        // 模型唯一标识
        $modeIdentifiers = array_map(fn (ModeEntity $modeEntity) => $modeEntity->getIdentifier(), $modesResult['list']);
        $officialAgentEntities = $this->getOfficialAgentEntities($superMagicAgentDataIsolation, $modeIdentifiers);

        /** @var ModeEntity $mode */
        foreach ($modesResult['list'] as $modeIndex => $mode) {
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

    /** @return array{0: array, 1: ?string} */
    private function preparePublishSkillReferences(SuperMagicAgentDataIsolation $dataIsolation, string $code, int $projectId, ProjectEntity $projectEntity): array
    {
        try {
            $bound = $this->skillsMdSyncService->getBoundSkills($dataIsolation, $code);
            $skillsMdHash = $this->skillsMdSyncService->syncSkillsMd(
                $projectId,
                $projectEntity,
                $dataIsolation->getCurrentOrganizationCode(),
                $projectEntity->getUserOrganizationCode(),
                [],
                SkillsMdSyncService::OPERATION_SYNC,
                $bound['system_skills'],
                $bound['market_skills'],
                true
            );
        } catch (RuntimeException $e) {
            // 发布前的严格重建失败（绑定技能无可用版本/非法包名/SKILLS.md 读写失败等）必须中止发布，
            // 但要以业务异常码暴露给用户，不能裸抛 RuntimeException 变成 500 + 英文原文
            ExceptionBuilder::throw(
                SuperAgentErrorCode::PUBLISH_SKILLS_SYNC_FAILED,
                'super_magic.agent.publish.skills_sync_failed',
                ['reason' => $e->getMessage()],
                null,
                $e
            );
        }
        $excludePaths = array_map(static fn (array $entry): string => 'skills/' . $entry['name'], $bound['market_skills']);
        return [$excludePaths, $skillsMdHash];
    }

    /**
     * 发布准备智能体版本.
     */
    private function publishPreparedAgentVersion(
        Authenticatable $authorization,
        SuperMagicAgentDataIsolation $dataIsolation,
        string $code,
        SuperMagicAgentEntity $agentEntity,
        AgentVersionEntity $versionEntity,
        bool $shouldExportFile
    ): PublishAgentResultDTO {
        $sandboxId = null;
        if ($shouldExportFile) {
            $projectId = $agentEntity->getProjectId();
            $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
            if ($projectEntity === null) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
            }
            [$excludePaths, $skillsMdHash] = $this->preparePublishSkillReferences($dataIsolation, $code, $projectId, $projectEntity);

            $sourcePath = $this->resolvePublishExportSourcePath($agentEntity->getProjectId());
            $this->validateIdentityMdExists($agentEntity->getProjectId());
            $fileMetadata = $this->exportFileFromProject($authorization, $code, $agentEntity->getProjectId(), $sourcePath, $excludePaths, $skillsMdHash);
            $sandboxId = $fileMetadata['sandbox_id'];
            $agentEntity->setFileKey($fileMetadata['file_key']);
        } else {
            $agentEntity->setFileKey('');
        }

        Db::beginTransaction();
        try {
            $previousVersion = $this->superMagicAgentVersionDomainService->getCurrentVersionByCodeForUpdate(
                $dataIsolation,
                $code
            );
            $versionEntity = $this->superMagicAgentVersionDomainService->publishAgent($dataIsolation, $agentEntity, $versionEntity);
            if ($versionEntity->getId() !== null) {
                $this->superMagicAgentCategoryRelationDomainService->replaceVersionCategories(
                    $dataIsolation,
                    $versionEntity->getId(),
                    $versionEntity->getCategoryIds()
                );
            }
            if ($versionEntity->getPublishStatus()->isPublished()) {
                // 只有当前版本已经生效时，才需要切换权限和市场状态。
                $this->syncAgentPublishScopeTransition(
                    $dataIsolation,
                    $agentEntity,
                    $previousVersion,
                    $versionEntity
                );
            }
            Db::commit();
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }

        return new PublishAgentResultDTO($versionEntity, $sandboxId);
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
     * 为 Agent 初始化所有者权限。
     *
     * 主要用于 create / import 等入口，补齐历史上可能缺失的所有者记录。
     */
    private function grantAgentOwnerPermission(
        SuperMagicAgentDataIsolation $dataIsolation,
        string $code,
        string $userId
    ): void {
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        $this->operationPermissionDomainService->accessOwner(
            $permissionDataIsolation,
            ResourceType::CustomAgent,
            $code,
            $userId
        );
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
