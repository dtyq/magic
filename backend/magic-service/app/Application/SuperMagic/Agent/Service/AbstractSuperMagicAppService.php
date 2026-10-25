<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Agent\Service;

use App\Application\Contact\UserSetting\UserSettingKey;
use App\Application\Kernel\AbstractKernelAppService;
use App\Application\ModelGateway\MicroAgent\MicroAgentFactory;
use App\Application\SuperMagic\Common\Collaboration\Policy\ResourceAccessPolicyService;
use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicUserSettingDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Mode\Entity\ModeEntity;
use App\Domain\Mode\Entity\ValueQuery\ModeQuery;
use App\Domain\Mode\Service\ModeDomainService;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType as OperationPermissionResourceType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityType;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Domain\SuperMagic\Agent\Entity\AgentMarketEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentVersionEntity;
use App\Domain\SuperMagic\Agent\Entity\SuperMagicAgentEntity;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentSourceType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\PublishTargetType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentType;
use App\Domain\SuperMagic\Agent\Service\MagicClawDomainService;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentCategoryRelationDomainService;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentDomainService;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentMarketDomainService;
use App\Domain\SuperMagic\Agent\Service\UserAgentDomainService;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Skill\Entity\SkillEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillVersionEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\BuiltinSkill;
use App\Domain\SuperMagic\Skill\Service\SkillMarketDomainService;
use App\ErrorCode\SuperMagicErrorCode;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\File\EasyFileTools;
use DateTime;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

abstract class AbstractSuperMagicAppService extends AbstractKernelAppService
{
    protected readonly LoggerInterface $logger;

    #[Inject]
    protected ResourceAccessPolicyService $resourceAccessPolicyService;

    #[Inject]
    protected UserAgentDomainService $userAgentDomainService;

    #[Inject]
    protected MagicClawDomainService $magicClawDomainService;

    #[Inject]
    protected SuperMagicAgentMarketDomainService $marketEligibilityDomainService;

    #[Inject]
    protected SuperMagicAgentCategoryRelationDomainService $marketCategoryRelationDomainService;

    #[Inject]
    protected SkillMarketDomainService $skillMarketDomainService;

    public function __construct(
        protected OperationPermissionDomainService $operationPermissionDomainService,
        protected SuperMagicAgentDomainService $superMagicAgentDomainService,
        protected ModeDomainService $modeDomainService,
        protected MagicUserSettingDomainService $magicUserSettingDomainService,
        protected ResourceVisibilityDomainService $resourceVisibilityDomainService,
        protected FileDomainService $fileDomainService,
        protected MicroAgentFactory $microAgentFactory,
        protected LoggerFactory $loggerFactory,
        protected AiAbilityDomainService $aiAbilityDomainService,
    ) {
        $this->logger = $this->loggerFactory->get(get_class($this));
    }

    public function assertAgentUsable(SuperMagicAgentDataIsolation $dataIsolation, string $code): void
    {
        if (in_array($code, $this->getUsableAgentCodes($dataIsolation)['codes'], true)) {
            return;
        }

        ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'super_magic.agent.agent_not_available');
    }

    /**
     * 根据话题模式统一判断员工、创建器和 MagicClaw 的使用权限。
     *
     * @return array{0: bool, 1: string}
     */
    public function checkAgentAccess(
        SuperMagicAgentDataIsolation $dataIsolation,
        string $topicPattern,
        string $agentCode
    ): array {
        $errorMessage = 'super_magic.agent.agent_not_available';

        if (in_array($topicPattern, [BuiltinSkill::CrewCreator->value, BuiltinSkill::SkillCreator->value], true)) {
            if ($agentCode === '') {
                return [true, ''];
            }

            $operation = $this->resourceAccessPolicyService->getCurrentOperation(
                $dataIsolation,
                OperationPermissionResourceType::CustomAgent,
                $agentCode
            );
            $allowed = $operation?->canEdit() ?? false;
            return [$allowed, $allowed ? '' : $errorMessage];
        }

        if ($topicPattern === ProjectMode::MAGICLAW->value) {
            // MagicClaw 是用户私有实例，只校验归属，不进入员工雇佣关系判断。
            $allowed = $this->magicClawDomainService->isOwnedBy(
                $agentCode,
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode()
            );
            return [$allowed, $allowed ? '' : $errorMessage];
        }

        $employeeCode = str_starts_with($topicPattern, 'SMA-') ? $topicPattern : $agentCode;
        if ($topicPattern === ProjectMode::CUSTOM_AGENT->value || str_starts_with($topicPattern, 'SMA-')) {
            $allowed = $employeeCode !== ''
                && in_array($employeeCode, $this->getUsableAgentCodes($dataIsolation)['codes'], true);
            return [$allowed, $allowed ? '' : $errorMessage];
        }

        return [true, ''];
    }

    /** 市场发现资格由领域服务统一计算，执行资格仍独立校验。 */
    protected function isMarketDiscoverableForUser(
        PermissionDataIsolation $permissionIsolation,
        AgentMarketEntity $market,
        string $userId
    ): bool {
        return $this->marketEligibilityDomainService->isMarketDiscoverableForUser($permissionIsolation, $market, $userId);
    }

    protected function assertMarketDiscoverableForUser(
        PermissionDataIsolation $permissionIsolation,
        AgentMarketEntity $market,
        string $userId
    ): void {
        if ($this->isMarketDiscoverableForUser($permissionIsolation, $market, $userId)) {
            return;
        }

        ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $market->getAgentCode()]);
    }

    /** @param AgentMarketEntity[] $agentMarkets */
    protected function fillMarketCategoryIds(array $agentMarkets): void
    {
        $marketIds = array_values(array_filter(array_map(
            static fn (AgentMarketEntity $market): ?int => $market->getId(),
            $agentMarkets
        )));
        $categoryIdsMap = $this->marketCategoryRelationDomainService->getMarketCategoryIdsMap($marketIds);
        foreach ($agentMarkets as $market) {
            if ($market->getId() !== null) {
                $market->setCategoryIds($categoryIdsMap[$market->getId()] ?? []);
            }
        }
    }

    /** 分类关系和市场信息必须在同一应用事务内更新。 */
    protected function updateMarketInfo(
        SuperMagicAgentDataIsolation $dataIsolation,
        int $id,
        array $payload
    ): bool {
        return Db::transaction(function () use ($dataIsolation, $id, $payload): bool {
            $updated = $this->marketEligibilityDomainService->updateInfoById($id, $payload);
            if ($updated && array_key_exists('category_ids', $payload)) {
                $this->marketCategoryRelationDomainService->replaceMarketCategories($dataIsolation, $id, $payload['category_ids']);
            }
            return $updated;
        });
    }

    protected function createFlowDataIsolation(Authenticatable|BaseDataIsolation $authorization): FlowDataIsolation
    {
        $dataIsolation = new FlowDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    protected function createSuperMagicDataIsolation(Authenticatable|BaseDataIsolation $authorization): SuperMagicAgentDataIsolation
    {
        $dataIsolation = new SuperMagicAgentDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    /**
     * 批量加载 Agent 版本列表关联的用户与部门信息.
     *
     * 传入组织编码时按该组织查询；不传时按版本所属组织分组查询，适用于管理后台跨组织列表。
     *
     * @param null|string $organizationCode 指定组织编码；为 null 时使用版本实体上的组织编码
     * @param AgentVersionEntity[] $versions
     * @return array{0: array<string, MagicUserEntity>, 1: array<string, MagicDepartmentEntity>}
     */
    protected function batchLoadAgentVersionRelatedEntities(?string $organizationCode, array $versions): array
    {
        $userIdsByOrganization = [];
        $departmentIdsByOrganization = [];

        foreach ($versions as $version) {
            $currentOrganizationCode = $organizationCode ?? $version->getOrganizationCode();
            if ($currentOrganizationCode === '') {
                continue;
            }

            if (! empty($version->getPublisherUserId())) {
                $userIdsByOrganization[$currentOrganizationCode][] = $version->getPublisherUserId();
            }

            $targetValue = $version->getPublishTargetValue();
            if ($targetValue === null || ! $version->getPublishTargetType()->requiresTargetValue()) {
                continue;
            }

            foreach ($targetValue->getUserIds() as $userId) {
                $userIdsByOrganization[$currentOrganizationCode][] = $userId;
            }
            foreach ($targetValue->getDepartmentIds() as $departmentId) {
                $departmentIdsByOrganization[$currentOrganizationCode][] = $departmentId;
            }
        }

        $userMap = [];
        foreach ($userIdsByOrganization as $currentOrganizationCode => $userIds) {
            foreach ($this->getUsers($currentOrganizationCode, array_values(array_unique($userIds))) as $userId => $userEntity) {
                $userMap[$userId] = $userEntity;
            }
        }

        $memberDepartmentMap = [];
        foreach ($departmentIdsByOrganization as $currentOrganizationCode => $departmentIds) {
            $departmentEntities = di(MagicDepartmentDomainService::class)->getDepartmentByIds(
                ContactDataIsolation::simpleMake($currentOrganizationCode),
                array_values(array_unique($departmentIds)),
                true
            );
            foreach ($departmentEntities as $departmentId => $departmentEntity) {
                $memberDepartmentMap[$departmentId] = $departmentEntity;
            }
        }

        return [$userMap, $memberDepartmentMap];
    }

    /**
     * 校验当前用户是否对 Agent 具备读取权限，返回当前用户的最高操作权限。
     *
     * 读权限采用「可见性 ∪ 操作权限」并集判定，适用于详情、版本列表、Playbook 列表等只读场景。
     * 内置 Agent（与官方 Mode 绑定的 Agent）不在协作权限体系内，对所有用户直接放行。
     *
     * @return ?Operation 用户对该 Agent 拥有的最高操作权限；内置 Agent 场景返回 null
     */
    protected function assertAgentReadable(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?Operation
    {
        try {
            return $this->resourceAccessPolicyService->assertReadable(
                $dataIsolation,
                OperationPermissionResourceType::CustomAgent,
                ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
                $code,
            );
        } catch (Throwable $throwable) {
            if (in_array($code, $this->getOfficialAgentCodes($dataIsolation), true)) {
                return null;
            }
            throw $throwable;
        }
    }

    /**
     * 校验完整员工详情的读取权限。
     *
     * 市场货架只用于发现和市场预览，不能直接读取 prompt、技能等完整配置。
     * 完整详情仅允许已雇佣/创建者、协作者及官方员工。
     */
    protected function assertAgentDetailReadable(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?Operation
    {
        $operation = $this->resourceAccessPolicyService->getCurrentOperation(
            $dataIsolation,
            OperationPermissionResourceType::CustomAgent,
            $code
        );
        if ($operation !== null) {
            return $operation;
        }

        if ($this->userAgentDomainService->findUserAgentOwnershipByCode($dataIsolation, $code) !== null
            || in_array($code, $this->getOfficialAgentCodes($dataIsolation), true)) {
            return null;
        }

        ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $code]);
    }

    /**
     * 同步 Agent 发布目标切换后的权限状态。
     *
     * 规则：
     * - MARKET -> MARKET：不处理
     * - MARKET -> INTERNAL：清市场关系，再重建内部可见性
     * - INTERNAL -> MARKET：清内部可见性
     * - INTERNAL -> INTERNAL：按当前版本重建内部可见性
     */
    protected function syncAgentPublishScopeTransition(
        SuperMagicAgentDataIsolation $dataIsolation,
        SuperMagicAgentEntity $agentEntity,
        ?AgentVersionEntity $previousVersion,
        AgentVersionEntity $currentVersion
    ): void {
        $previousTargetType = $previousVersion?->getPublishTargetType();
        $currentTargetType = $currentVersion->getPublishTargetType();

        if ($previousTargetType === PublishTargetType::MARKET && $currentTargetType === PublishTargetType::MARKET) {
            return;
        }

        if ($currentTargetType === PublishTargetType::MARKET) {
            if ($previousTargetType !== null && $previousTargetType !== PublishTargetType::MARKET) {
                if (in_array($previousTargetType, [PublishTargetType::ORGANIZATION, PublishTargetType::MEMBER], true)) {
                    $this->clearOrganizationMarketShelf($dataIsolation, $agentEntity->getCode());
                }
                $hiredUserIds = [];
                $markets = $this->superMagicAgentDomainService->getStoreAgentsByAgentCodes([$agentEntity->getCode()]);
                $market = $markets[$agentEntity->getCode()] ?? null;
                if ($market !== null && $market->getId() !== null) {
                    $hiredUserIds = array_map(
                        static fn ($ownership): string => $ownership->getUserId(),
                        $this->userAgentDomainService->findUserAgentOwnershipsByMarketSource($dataIsolation, $market->getId())
                    );
                }
                // 从内部切到公开市场时，清掉内部共享可见性，但保留创建者和已雇佣用户的兼容可见。
                $this->saveAgentVisibility(
                    $this->createAgentPermissionDataIsolation($dataIsolation, $agentEntity),
                    $agentEntity->getCode(),
                    VisibilityType::SPECIFIC,
                    array_values(array_unique(array_merge([$agentEntity->getCreator()], $hiredUserIds)))
                );
            }
            return;
        }

        if ($previousTargetType === PublishTargetType::MARKET) {
            // 从市场切回内部时，先清市场分发，再回收市场安装关系。
            $this->superMagicAgentDomainService->offlineMarketPublishings($dataIsolation, $agentEntity->getCode());
            $this->userAgentDomainService->deleteUserAgentOwnershipsExceptUser(
                $dataIsolation,
                $agentEntity->getCode(),
                $agentEntity->getCreator()
            );
        }

        if (in_array($previousTargetType, [PublishTargetType::ORGANIZATION, PublishTargetType::MEMBER], true)
            && $currentTargetType === PublishTargetType::PRIVATE) {
            // 组织共享下架为个人发布：同步撤销货架及所有非创建者的该货架雇佣。
            $this->clearOrganizationMarketShelf($dataIsolation, $agentEntity->getCode());
            $this->superMagicAgentDomainService->offlineMarketPublishings($dataIsolation, $agentEntity->getCode());
            $this->userAgentDomainService->deleteUserAgentOwnershipsExceptUser(
                $dataIsolation,
                $agentEntity->getCode(),
                $agentEntity->getCreator()
            );
        }

        $dataIsolation->disabled();
        $this->syncInternalAgentVisibility($dataIsolation, $agentEntity, $currentVersion);
    }

    protected function saveAgentVisibility(
        BaseDataIsolation|PermissionDataIsolation $dataIsolation,
        string $code,
        VisibilityType $visibilityType,
        array $userIds = [],
        array $departmentIds = []
    ): void {
        $this->resourceVisibilityDomainService->saveVisibilityByPrincipals(
            $this->createPermissionDataIsolation($dataIsolation),
            ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
            $code,
            $visibilityType,
            $userIds,
            $departmentIds
        );
    }

    /**
     * 校验当前用户是否对 Agent 具备编辑权限。
     */
    protected function assertAgentEditable(SuperMagicAgentDataIsolation $dataIsolation, string $code): void
    {
        $this->resourceAccessPolicyService->assertEditable(
            $dataIsolation,
            OperationPermissionResourceType::CustomAgent,
            $code
        );
    }

    /**
     * 校验当前用户是否对 Agent 具备删除权限。
     *
     * 仅 owner 及被授予管理权限的协作者可删除，与「可编辑」语义不同。
     */
    protected function assertAgentDeletable(SuperMagicAgentDataIsolation $dataIsolation, string $code): void
    {
        $this->resourceAccessPolicyService->assertDeletable(
            $dataIsolation,
            OperationPermissionResourceType::CustomAgent,
            $code
        );
    }

    /**
     * 获取用户可访问的智能体编码列表.
     * @return array{accessible: array<string>, creator: array<string>, codes: array<string>, operations: array<string, Operation>}
     */
    protected function getAccessibleAgentCodes(SuperMagicAgentDataIsolation $dataIsolation, string $userId): array
    {
        /** @var array{operations: array<string, Operation>, all_codes: array<string>} $accessibleAgentResult */
        $accessibleAgentResult = $this->resourceAccessPolicyService->getReadableResourceCodes(
            $dataIsolation,
            OperationPermissionResourceType::CustomAgent,
            ResourceVisibilityResourceType::SUPER_MAGIC_AGENT
        );
        /** @var array<string> $accessibleCodes */
        $accessibleCodes = $accessibleAgentResult['all_codes'] ?? [];
        // 查询用户自己创建的智能体编码（用户创建的必然可见）
        /** @var array<string> $creatorCodes */
        $creatorCodes = $this->superMagicAgentDomainService->getCodesByCreator($dataIsolation, $userId);

        // 从 $accessibleCodes 从剔除 $creatorCodes
        $accessibleCodes = array_values(array_diff($accessibleCodes, $creatorCodes));

        // 合并并去重
        return [
            'accessible' => $accessibleCodes,
            'creator' => $creatorCodes,
            'codes' => array_values(array_unique(array_merge($creatorCodes, $accessibleCodes))),
            'operations' => $accessibleAgentResult['operations'] ?? [],
        ];
    }

    /**
     * 获取当前用户真正可使用的员工编码。
     *
     * 可用性与可读性不同：协作权限和资源可见性只用于读取/管理，不能让未雇佣用户执行员工。
     *
     * @return array{codes: array<string>}
     */
    protected function getUsableAgentCodes(SuperMagicAgentDataIsolation $dataIsolation): array
    {
        $ownedCodes = $this->userAgentDomainService->findAgentCodesBySourceTypes(
            $dataIsolation,
            [AgentSourceType::LOCAL_CREATE->value, AgentSourceType::MARKET->value]
        );
        $officialCodes = $this->getOfficialAgentCodes($dataIsolation);

        return [
            'codes' => array_values(array_unique(array_merge($ownedCodes, $officialCodes))),
        ];
    }

    /**
     * 获取团队共享可用的 Agent 编码列表。
     *
     * 仅返回当前用户可见，且排除本人创建和市场安装后的编码列表。
     *
     * @return array{codes: array<string>, operations: array<string, Operation>}
     */
    protected function getTeamSharedReadableAgentCodes(SuperMagicAgentDataIsolation $dataIsolation): array
    {
        /** @var array{operations: array<string, Operation>, operation_codes: array<string>, visibility_codes: array<string>, all_codes: array<string>} $accessibleAgentResult */
        $accessibleAgentResult = $this->resourceAccessPolicyService->getReadableResourceCodes(
            $dataIsolation,
            OperationPermissionResourceType::CustomAgent,
            ResourceVisibilityResourceType::SUPER_MAGIC_AGENT
        );
        /** @var array<string> $accessibleCodes */
        $accessibleCodes = $accessibleAgentResult['all_codes'] ?? [];
        /** @var array<string> $creatorCodes */
        $creatorCodes = $this->superMagicAgentDomainService->getCodesByCreator(
            $dataIsolation,
            $dataIsolation->getCurrentUserId()
        );
        $marketInstalledCodes = $this->getMarketInstalledAgentCodes($dataIsolation);

        $excludedCodes = array_values(array_unique(array_merge($creatorCodes, $marketInstalledCodes)));

        return [
            'codes' => array_values(array_diff($accessibleCodes, $excludedCodes)),
            'operations' => $accessibleAgentResult['operations'],
        ];
    }

    /**
     * 获取当前用户参与协作的员工编码。
     *
     * 该集合仅表达协作身份，不依赖货架可见性或雇佣关系，也不代表可执行资格。
     *
     * @return array{codes: array<string>, operations: array<string, Operation>}
     */
    protected function getCollaboratedAgentCodes(SuperMagicAgentDataIsolation $dataIsolation): array
    {
        /** @var array{operations: array<string, Operation>, operation_codes: array<string>} $accessibleAgentResult */
        $accessibleAgentResult = $this->resourceAccessPolicyService->getReadableResourceCodes(
            $dataIsolation,
            OperationPermissionResourceType::CustomAgent,
            ResourceVisibilityResourceType::SUPER_MAGIC_AGENT
        );
        $creatorCodes = $this->superMagicAgentDomainService->getCodesByCreator(
            $dataIsolation,
            $dataIsolation->getCurrentUserId()
        );
        $codes = array_values(array_diff($accessibleAgentResult['operation_codes'] ?? [], $creatorCodes));

        return [
            'codes' => $codes,
            'operations' => array_intersect_key(
                $accessibleAgentResult['operations'] ?? [],
                array_fill_keys($codes, true)
            ),
        ];
    }

    /**
     * 获取通过市场安装的 Agent 编码列表。
     *
     * @return array<string>
     */
    protected function getMarketInstalledAgentCodes(SuperMagicAgentDataIsolation $dataIsolation): array
    {
        /* @var array<string> $marketInstalledCodes */
        return $this->userAgentDomainService->findAgentCodesBySourceTypes(
            $dataIsolation,
            [AgentSourceType::MARKET->value]
        );
    }

    /**
     * 获取用户可访问的技能代码，并兼容系统内置技能白名单。
     *
     * @param array<string> $skillCodes
     * @return array<string>
     */
    protected function getAccessibleSkillCodesWithBuiltinFallback(
        SuperMagicAgentDataIsolation $dataIsolation,
        ?array $skillCodes = null
    ): array {
        /** @var array<string> $accessibleSkillCodes */
        $accessibleSkillCodes = $this->resourceAccessPolicyService->getReadableResourceCodes(
            $dataIsolation,
            OperationPermissionResourceType::Skill,
            ResourceVisibilityResourceType::SKILL,
            $skillCodes
        )['all_codes'] ?? [];

        return array_values(array_unique(array_merge(
            $accessibleSkillCodes,
            array_values(array_intersect(
                $this->skillMarketDomainService->getOfficialBuiltinSkillCodes(),
                $skillCodes ?? []
            ))
        )));
    }

    protected function createBuiltinAgentEntityByMode(SuperMagicAgentDataIsolation $superMagicAgentDataIsolation, ModeEntity $modeEntity): SuperMagicAgentEntity
    {
        $entity = new SuperMagicAgentEntity();

        // 设置基本信息
        $entity->setOrganizationCode($superMagicAgentDataIsolation->getCurrentOrganizationCode());
        $entity->setCode($modeEntity->getIdentifier());
        $entity->setName($modeEntity->getName());
        $entity->setDescription($modeEntity->getPlaceholder());
        $entity->setIcon([
            'url' => $modeEntity->getIconUrl(),
            'type' => $modeEntity->getIcon(),
            'color' => $modeEntity->getColor(),
        ]);
        $entity->setIconType($modeEntity->getIconType());
        $entity->setType(SuperMagicAgentType::Built_In);
        $entity->setEnabled(true);
        $entity->setPrompt([]);
        $entity->setTools([]);

        // 设置系统创建信息
        $entity->setCreator('system');
        $entity->setCreatedAt(new DateTime());
        $entity->setModifier('system');
        $entity->setUpdatedAt(new DateTime());

        return $entity;
    }

    /**
     * 获取智能体排列配置.
     * @return null|array{frequent: array<string>, all: array<string>}
     */
    protected function getOrderConfig(Authenticatable $authorization): ?array
    {
        $dataIsolation = $this->createContactDataIsolation($authorization);
        $setting = $this->magicUserSettingDomainService->get($dataIsolation, UserSettingKey::SuperMagicAgentSort->value);

        return $setting?->getValue();
    }

    /**
     * 获取默认排序配置：内置智能体的前6个作为frequent.
     * @param array<SuperMagicAgentEntity> $agents
     */
    protected function getDefaultOrderConfig(array $agents): array
    {
        $builtinCodes = [];
        $customCodes = [];

        foreach ($agents as $agent) {
            if ($agent->getType()->isBuiltIn()) {
                $builtinCodes[] = $agent->getCode();
            } else {
                $customCodes[] = $agent->getCode();
            }
        }

        // 内置智能体的前6个作为frequent
        $frequent = array_slice($builtinCodes, 0, 6);

        // all包含所有智能体（内置+自定义）
        $all = array_merge($builtinCodes, $customCodes);

        return [
            'frequent' => $frequent,
            'all' => $all,
        ];
    }

    /**
     * 将智能体列表按照用户配置分类为frequent和all.
     */
    protected function categorizeAgents(array $agents, int $total, ?array $orderConfig): array
    {
        // 如果没有用户配置，使用默认配置：内置智能体的前6个作为frequent
        if (empty($orderConfig)) {
            $orderConfig = $this->getDefaultOrderConfig($agents);
        }

        $frequentCodes = $orderConfig['frequent'] ?? [];
        $allOrder = $orderConfig['all'] ?? [];

        // 创建code到entity的映射
        $agentMap = [];
        foreach ($agents as $agent) {
            $agentMap[$agent->getCode()] = $agent;
        }

        // 构建frequent列表
        $frequent = [];
        foreach ($frequentCodes as $code) {
            if (isset($agentMap[$code])) {
                $agentMap[$code]->setCategory('frequent');
                $frequent[] = $agentMap[$code];
            }
        }

        // 构建all列表（排除frequent中的）
        $all = [];
        $frequentCodesSet = array_flip($frequentCodes);

        // 如果有排序配置，按配置排序
        if (! empty($allOrder)) {
            foreach ($allOrder as $code) {
                if (isset($agentMap[$code]) && ! isset($frequentCodesSet[$code])) {
                    $agentMap[$code]->setCategory('all');
                    $all[] = $agentMap[$code];
                }
            }

            // 添加不在排序配置中的智能体
            foreach ($agents as $agent) {
                $code = $agent->getCode();
                if (! in_array($code, $allOrder) && ! isset($frequentCodesSet[$code])) {
                    $agent->setCategory('all');
                    $all[] = $agent;
                }
            }
        } else {
            // 没有排序配置，直接过滤frequent
            foreach ($agents as $agent) {
                if (! isset($frequentCodesSet[$agent->getCode()])) {
                    $agent->setCategory('all');
                    $all[] = $agent;
                }
            }
        }

        return [
            'frequent' => $frequent,
            'all' => $all,
            'total' => $total,
        ];
    }

    /**
     * 更新AgentIcon.
     */
    protected function updateAgentEntityIcon(SuperMagicAgentEntity $agentEntity): SuperMagicAgentEntity
    {
        $this->updateAgentEntitiesIcon([$agentEntity]);
        return $agentEntity;
    }

    /**
     * 更新AgentIcon.
     *
     * @param AgentVersionEntity[]|SuperMagicAgentEntity[] $agentEntities
     * @return SuperMagicAgentEntity[]
     */
    protected function updateAgentEntitiesIcon(array $agentEntities): array
    {
        // 按组织代码分组收集需要转换的路径，并建立路径到 agent code 的映射
        $codeMapUrls = [];
        foreach ($agentEntities as $agent) {
            $formattedPath = EasyFileTools::formatPath($agent->getIcon()['url'] ?? '');
            if (! $formattedPath) {
                $formattedPath = EasyFileTools::formatPath($agent->getIcon()['value'] ?? '');
            }
            if ($formattedPath) {
                $codeMapUrls[$agent->getOrganizationCode()][$agent->getCode()] = $formattedPath;
            }
        }

        foreach ($codeMapUrls as $organizationCode => $codeMapUrl) {
            $fileUrlsMap = $this->getIcons($organizationCode, $codeMapUrl);

            foreach ($agentEntities as $agentEntity) {
                if (! isset($codeMapUrls[$agentEntity->getOrganizationCode()][$agentEntity->getCode()])) {
                    continue;
                }

                $iconUrl = $codeMapUrls[$agentEntity->getOrganizationCode()][$agentEntity->getCode()];
                $fileLink = $fileUrlsMap[$iconUrl] ?? null;
                if (! $fileLink) {
                    continue;
                }
                $icon = $agentEntity->getIcon();
                $icon['url'] = $fileLink->getUrl();
                $icon['value'] = $fileLink->getUrl();
                $agentEntity->setIcon($icon);
            }
        }
        return $agentEntities;
    }

    /**
     * 更新 Skill 实体的 Logo URL（将路径转换为完整URL）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param array<SkillEntity|SkillVersionEntity> $skillEntities Skill 实体数组
     */
    protected function updateSkillLogoUrls(SuperMagicAgentDataIsolation $dataIsolation, array $skillEntities): void
    {
        if (empty($skillEntities)) {
            return;
        }

        // 按组织代码分组收集需要转换的路径
        $pathsByOrg = [];
        foreach ($skillEntities as $skillEntity) {
            $formattedPath = EasyFileTools::formatPath($skillEntity->getLogo() ?? '');
            if ($formattedPath) {
                $orgCode = $skillEntity->getOrganizationCode();
                $pathsByOrg[$orgCode][] = $formattedPath;
            }
        }

        if (empty($pathsByOrg)) {
            return;
        }

        // 按组织批量获取文件 URL
        $allFileLinksMap = [];
        foreach ($pathsByOrg as $orgCode => $paths) {
            $fileLinksMap = $this->getIcons($orgCode, $paths);
            $allFileLinksMap[$orgCode] = $fileLinksMap;
        }

        // 更新 Skill 实体的 logo URL
        foreach ($skillEntities as $skillEntity) {
            $formattedPath = EasyFileTools::formatPath($skillEntity->getLogo() ?? '');
            if ($formattedPath) {
                $fileLink = $allFileLinksMap[$skillEntity->getOrganizationCode()][$formattedPath] ?? null;
                $skillEntity->setLogo($fileLink instanceof FileLink ? $fileLink->getUrl() : null);
            }
        }
    }

    /**
     * 更新 Category Logo URL（将路径转换为完整URL）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param array<int, array<string, mixed>> $categories Category 数组，每个元素包含 'logo' 字段
     */
    protected function updateCategoryLogoUrls(SuperMagicAgentDataIsolation $dataIsolation, array &$categories): void
    {
        if (empty($categories)) {
            return;
        }

        // 按组织代码分组收集需要转换的路径
        $pathsByOrg = [];
        foreach ($categories as $category) {
            $formattedPath = EasyFileTools::formatPath($category['logo'] ?? '');
            if ($formattedPath) {
                $orgCode = $dataIsolation->getCurrentOrganizationCode();
                $pathsByOrg[$orgCode][] = $formattedPath;
            }
        }

        if (empty($pathsByOrg)) {
            return;
        }

        // 按组织批量获取文件 URL
        $allFileLinksMap = [];
        foreach ($pathsByOrg as $orgCode => $paths) {
            $fileLinksMap = $this->getIcons($orgCode, $paths);
            $allFileLinksMap[$orgCode] = $fileLinksMap;
        }

        // 更新 Category 的 logo URL
        foreach ($categories as &$category) {
            $formattedPath = EasyFileTools::formatPath($category['logo'] ?? '');
            if ($formattedPath) {
                $orgCode = $dataIsolation->getCurrentOrganizationCode();
                $fileLink = $allFileLinksMap[$orgCode][$formattedPath] ?? null;
                if ($fileLink instanceof FileLink) {
                    $category['logo'] = $fileLink->getUrl();
                }
            }
        }
    }

    /**
     * 更新 Skill 实体的 FileUrl（根据 fileKey 获取私有链接）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param array<SkillEntity|SkillVersionEntity> $skillEntities Skill 实体数组
     */
    protected function updateSkillFileUrl(SuperMagicAgentDataIsolation $dataIsolation, array $skillEntities): void
    {
        if (empty($skillEntities)) {
            return;
        }

        // 按组织代码分组收集需要转换的路径
        $pathsByOrg = [];
        foreach ($skillEntities as $skillEntity) {
            $pathsByOrg[$skillEntity->getOrganizationCode()][] = $skillEntity->getFileKey();
        }

        // 按组织批量获取文件 URL
        $allFileLinksMap = [];
        foreach ($pathsByOrg as $orgCode => $paths) {
            $fileLinksMap = $this->getPrivateFileLinks($orgCode, $paths);
            $allFileLinksMap[$orgCode] = $fileLinksMap;
        }

        // 更新 Skill 实体的 logo URL
        foreach ($skillEntities as $skillEntity) {
            $fileLink = $allFileLinksMap[$skillEntity->getOrganizationCode()][$skillEntity->getFileKey()] ?? null;
            $skillEntity->setFileUrl($fileLink instanceof FileLink ? $fileLink->getUrl() : null);
        }
    }

    protected function updateAgentFileUrl(SuperMagicAgentEntity $agentEntity): void
    {
        $fileKey = $agentEntity->getFileKey();
        if (empty($fileKey)) {
            return;
        }

        $fileLink = $this->getPrivateFileLinks($agentEntity->getOrganizationCode(), [$fileKey])[$fileKey] ?? null;
        $agentEntity->setFileUrl($fileLink instanceof FileLink ? $fileLink->getUrl() : null);
    }

    /**
     * 获取所有内置 Agent（官方 Mode）的 code 列表。
     *
     * 接受 Authenticatable 或 BaseDataIsolation，兼容从用户授权对象和数据隔离对象两种调用场景。
     */
    protected function getOfficialAgentCodes(Authenticatable|BaseDataIsolation $authorization): array
    {
        $modeDataIsolation = $this->createModeDataIsolation($authorization);
        $modeDataIsolation->disabled();

        // 获取后台的所有模式，用于封装数据到 Agent 中
        $query = new ModeQuery(status: true);
        $modeEntities = $this->modeDomainService->getOrganizationVisibleModes($modeDataIsolation, $query, Page::createNoPage())['list'];

        return array_map(fn (ModeEntity $modeEntity) => $modeEntity->getIdentifier(), $modeEntities);
    }

    private function syncInternalAgentVisibility(
        SuperMagicAgentDataIsolation $dataIsolation,
        SuperMagicAgentEntity $agentEntity,
        AgentVersionEntity $currentVersion
    ): void {
        if ($currentVersion->getPublishTargetType() === PublishTargetType::ORGANIZATION) {
            // 组织可见，直接开放全员可见。
            $this->saveAgentVisibility($dataIsolation, $agentEntity->getCode(), VisibilityType::ALL);
            return;
        }

        if ($currentVersion->getPublishTargetType() === PublishTargetType::MEMBER) {
            $publishTargetValue = $currentVersion->getPublishTargetValue();
            $userIds = array_values(array_unique(array_merge(
                [$agentEntity->getCreator()],
                $publishTargetValue?->getUserIds() ?? []
            )));

            // 成员发布时，保留创建者并叠加显式成员和部门。
            $this->saveAgentVisibility(
                $dataIsolation,
                $agentEntity->getCode(),
                VisibilityType::SPECIFIC,
                $userIds,
                $publishTargetValue?->getDepartmentIds() ?? []
            );
            return;
        }

        // PRIVATE 只保留创建者可见。
        $privateDataIsolation = clone $dataIsolation;
        $privateDataIsolation->disabled();

        $this->saveAgentVisibility(
            $privateDataIsolation,
            $agentEntity->getCode(),
            VisibilityType::SPECIFIC,
            [$agentEntity->getCreator()]
        );
    }

    private function createAgentPermissionDataIsolation(
        BaseDataIsolation $dataIsolation,
        SuperMagicAgentEntity $agentEntity
    ): PermissionDataIsolation {
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        $agentOrganizationCode = $agentEntity->getOrganizationCode();
        if ($agentOrganizationCode !== '') {
            $permissionDataIsolation->setCurrentOrganizationCode($agentOrganizationCode);
        }

        return $permissionDataIsolation;
    }

    /**
     * Clear a previously organization-scoped shelf while retaining the market
     * record itself. This is used when a publication changes back to public or
     * private; individual employee visibility is handled separately.
     */
    private function clearOrganizationMarketShelf(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): void
    {
        $markets = $this->superMagicAgentDomainService->getStoreAgentsByAgentCodes([$agentCode]);
        $market = $markets[$agentCode] ?? null;
        if ($market === null || $market->getId() === null) {
            return;
        }

        $this->resourceVisibilityDomainService->saveVisibilityByPrincipals(
            $this->createPermissionDataIsolation($dataIsolation),
            ResourceVisibilityResourceType::SUPER_MAGIC_AGENT_MARKET,
            (string) $market->getId(),
            VisibilityType::NONE
        );
    }
}
