<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Agent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType as OperationPermissionResourceType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityType;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Domain\SuperMagic\Agent\Entity\AgentMarketEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentPlaybookEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentVersionEntity;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentMarketType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\PublishTargetType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\Query\AgentMarketQuery;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentMarketRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Facade\AgentPlaybookRepositoryInterface;
use App\Infrastructure\Core\ValueObject\Page;

/**
 * Domain service for market agent read operations.
 */
class SuperMagicAgentMarketDomainService
{
    public function __construct(
        protected AgentPlaybookRepositoryInterface $agentPlaybookRepository,
        protected AgentMarketRepositoryInterface $agentMarketRepository,
        protected ResourceVisibilityDomainService $resourceVisibilityDomainService,
        protected OperationPermissionDomainService $operationPermissionDomainService,
        protected UserAgentDomainService $userAgentDomainService,
        protected MagicDepartmentUserRepositoryInterface $departmentUserRepository,
    ) {
    }

    /**
     * Return a published market record by agent code.
     */
    public function getPublishedByAgentCode(string $agentCode): ?AgentMarketEntity
    {
        return $this->agentMarketRepository->findByAgentCode($agentCode);
    }

    /**
     * Return the market record by agent code regardless of publish status.
     */
    public function getByAgentCodeWithoutStatus(string $agentCode): ?AgentMarketEntity
    {
        return $this->agentMarketRepository->findByAgentCodeWithoutStatus($agentCode);
    }

    /**
     * 锁定市场记录后再校验雇佣资格，避免协作者撤权与雇佣并发留下失效关系。
     */
    public function getPublishedByAgentCodeForUpdate(
        string $organizationCode,
        string $agentCode
    ): ?AgentMarketEntity {
        return $this->agentMarketRepository->findPublishedByAgentCodeForUpdate(
            $organizationCode,
            $agentCode
        );
    }

    /**
     * 协作者权限变化后锁定组织市场，并收口该市场来源的雇佣关系。
     */
    public function getPublishedOrganizationMarketByAgentCodeForUpdate(
        string $organizationCode,
        string $agentCode
    ): ?AgentMarketEntity {
        return $this->agentMarketRepository->findPublishedOrganizationByAgentCodeForUpdate(
            $organizationCode,
            $agentCode
        );
    }

    /**
     * 查询当前用户可发现的组织共享市场 ID。
     *
     * 货架只表达发布范围；创建者和协作者资格在运行时合并，避免把动态权限反写到货架。
     *
     * @return int[]
     */
    public function getDiscoverableOrganizationMarketIds(
        PermissionDataIsolation $permissionIsolation,
        string $userId
    ): array {
        $organizationCode = $permissionIsolation->getCurrentOrganizationCode();
        $shelfIds = $this->getMarketShelfIds($permissionIsolation, $userId);
        $collaborativeAgentCodes = $this->getCollaborativeAgentCodes($permissionIsolation, $userId);
        $collaborativeMarketIds = $this->agentMarketRepository->findPublishedOrganizationIdsByAgentCodes(
            $organizationCode,
            $collaborativeAgentCodes
        );
        $publisherMarketIds = $this->agentMarketRepository->findPublishedOrganizationIdsByPublisher(
            $organizationCode,
            $userId
        );

        return array_values(array_unique(array_merge(
            array_map('intval', $shelfIds),
            $collaborativeMarketIds,
            $publisherMarketIds
        )));
    }

    /**
     * 使用发布版本的目标范围模拟市场资格，供首次迁移 dry-run 与实际迁移共用。
     *
     * @return string[] creator|collaborator|shelf
     */
    public function getVersionMarketDiscoverabilitySourcesForUser(
        PermissionDataIsolation $permissionIsolation,
        AgentVersionEntity $version,
        string $userId
    ): array {
        $targetType = $version->getPublishTargetType();
        if (! in_array($targetType, [PublishTargetType::ORGANIZATION, PublishTargetType::MEMBER], true)
            || $version->getOrganizationCode() !== $permissionIsolation->getCurrentOrganizationCode()) {
            return [];
        }

        $sources = [];
        if ($version->getCreator() === $userId) {
            $sources[] = 'creator';
        }
        if ($this->hasCollaborativeOperation($permissionIsolation, $version->getCode(), $userId)) {
            $sources[] = 'collaborator';
        }
        if ($targetType === PublishTargetType::ORGANIZATION || $this->isVersionMemberTarget($permissionIsolation, $version, $userId)) {
            $sources[] = 'shelf';
        }

        return $sources;
    }

    /**
     * 市场资格只控制发现和雇佣；执行仍由 user_agents 的统一可用性校验决定。
     */
    public function isMarketDiscoverable(
        AgentMarketEntity $market,
        string $organizationCode,
        string $userId,
        bool $shelfVisible,
        bool $hasCollaborativeOperation,
    ): bool {
        if (! $market->getPublishStatus()->isPublished() || $market->isHidden()) {
            return false;
        }
        if ($market->getMarketType() === AgentMarketType::MARKET) {
            return true;
        }
        if ($market->getMarketType() !== AgentMarketType::ORGANIZATION
            || $market->getOrganizationCode() !== $organizationCode
            || $market->getId() === null) {
            return false;
        }

        return $market->getPublisherId() === $userId || $shelfVisible || $hasCollaborativeOperation;
    }

    /**
     * 组织市场的详情和雇佣共用同一资格判断，禁止接口层自行组合条件。
     */
    public function isMarketDiscoverableForUser(
        PermissionDataIsolation $permissionIsolation,
        AgentMarketEntity $market,
        string $userId
    ): bool {
        return $this->getMarketDiscoverabilitySourcesForUser($permissionIsolation, $market, $userId) !== [];
    }

    /**
     * 返回用户命中市场资格的来源，供迁移 dry-run 审核与在线撤权复用。
     *
     * @return string[] public|creator|collaborator|shelf
     */
    public function getMarketDiscoverabilitySourcesForUser(
        PermissionDataIsolation $permissionIsolation,
        AgentMarketEntity $market,
        string $userId
    ): array {
        if (! $market->getPublishStatus()->isPublished() || $market->isHidden()) {
            return [];
        }
        if ($market->getMarketType() === AgentMarketType::MARKET) {
            return ['public'];
        }
        if ($market->getMarketType() !== AgentMarketType::ORGANIZATION
            || $market->getOrganizationCode() !== $permissionIsolation->getCurrentOrganizationCode()
            || $market->getId() === null) {
            return [];
        }

        $sources = [];
        if ($market->getPublisherId() === $userId) {
            $sources[] = 'creator';
        }
        if ($this->hasCollaborativeOperation($permissionIsolation, $market->getAgentCode(), $userId)) {
            $sources[] = 'collaborator';
        }
        if ($this->isMarketShelfVisible($permissionIsolation, $userId, $market->getId())) {
            $sources[] = 'shelf';
        }

        return $sources;
    }

    /**
     * 发布范围或协作权限变化后，撤销失去市场资格的 MARKET 雇佣并同步兼容可见性。
     */
    public function syncOrganizationMarketHireAccess(
        PermissionDataIsolation $permissionIsolation,
        AgentMarketEntity $market
    ): void {
        $market = $this->getPublishedOrganizationMarketByAgentCodeForUpdate(
            $permissionIsolation->getCurrentOrganizationCode(),
            $market->getAgentCode()
        );
        if ($market === null || $market->getId() === null) {
            return;
        }

        $dataIsolation = SuperMagicAgentDataIsolation::create(
            $permissionIsolation->getCurrentOrganizationCode(),
            $permissionIsolation->getCurrentUserId()
        );
        $ownerships = $this->userAgentDomainService->findUserAgentOwnershipsByMarketSource($dataIsolation, $market->getId());
        $revokedUserIds = [];
        $hiredUserIds = [];
        foreach ($ownerships as $ownership) {
            if ($this->isMarketDiscoverableForUser($permissionIsolation, $market, $ownership->getUserId())) {
                $hiredUserIds[] = $ownership->getUserId();
                continue;
            }
            $revokedUserIds[] = $ownership->getUserId();
        }
        $this->userAgentDomainService->deleteUserAgentOwnershipsByMarketSourceAndUsers(
            $dataIsolation,
            $market->getId(),
            $revokedUserIds
        );

        $this->resourceVisibilityDomainService->saveVisibilityByPrincipals(
            $permissionIsolation,
            ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
            $market->getAgentCode(),
            VisibilityType::SPECIFIC,
            array_values(array_unique(array_merge([$market->getPublisherId()], $hiredUserIds)))
        );
    }

    public function getById(int $id): ?AgentMarketEntity
    {
        return $this->agentMarketRepository->findById($id);
    }

    /**
     * Query the published market list.
     *
     * @param AgentMarketQuery $query Query conditions
     * @param Page $page Page request
     * @return array{total: int, list: array<AgentMarketEntity>}
     */
    public function queries(AgentMarketQuery $query, Page $page): array
    {
        return $this->agentMarketRepository->queries($query, $page);
    }

    /** Return eligible market IDs for a full vector-index scan. */
    public function findVectorIndexIds(string $afterId = '0', int $limit = 100): array
    {
        return $this->agentMarketRepository->findVectorIndexIds($afterId, $limit);
    }

    /**
     * 管理后台查询员工市场列表.
     *
     * @return array{total: int, list: array<AgentMarketEntity>}
     */
    public function queryAdminMarkets(
        ?string $publishStatus,
        ?string $organizationCode,
        ?string $name18n,
        ?string $publisherType,
        ?string $agentCode,
        ?string $startTime,
        ?string $endTime,
        ?array $categoryIds,
        string $orderBy,
        Page $page
    ): array {
        return $this->agentMarketRepository->queryAdminMarkets(
            $publishStatus,
            $organizationCode,
            $name18n,
            $publisherType,
            $agentCode,
            $startTime,
            $endTime,
            $categoryIds,
            $orderBy,
            $page
        );
    }

    /**
     * Load playbooks in batch for the market list.
     *
     * @param int[] $agentVersionIds Agent version ids
     * @return array<int, AgentPlaybookEntity[]> Playbooks grouped by agent_version_id
     */
    public function getPlaybooksByAgentVersionIds(array $agentVersionIds): array
    {
        return $this->agentPlaybookRepository->getByAgentVersionIds($agentVersionIds);
    }

    /**
     * 更新市场员工排序值.
     */
    public function updateSortOrderById(int $id, int $sortOrder): bool
    {
        return $this->agentMarketRepository->updateSortOrderById($id, $sortOrder);
    }

    /**
     * 按传入字段部分更新市场员工信息.
     *
     * @param array{
     *     name_i18n?: null|array,
     *     description_i18n?: null|array,
     *     role_i18n?: null|array,
     *     icon?: null|array,
     *     icon_type?: null|int,
     *     sort_order?: null|int,
     *     is_featured?: bool,
     *     is_hidden?: bool,
     *     category_ids?: int[]
     * } $payload
     */
    public function updateInfoById(int $id, array $payload): bool
    {
        return $this->agentMarketRepository->updateInfoById($id, $payload);
    }

    /** @return string[] */
    private function getCollaborativeAgentCodes(PermissionDataIsolation $permissionIsolation, string $userId): array
    {
        $operationMap = $this->operationPermissionDomainService->getResourceOperationByUserIds(
            $permissionIsolation,
            OperationPermissionResourceType::CustomAgent,
            [$userId]
        );

        $codes = [];
        foreach ($operationMap[$userId] ?? [] as $agentCode => $operation) {
            if ($operation !== Operation::None) {
                $codes[] = (string) $agentCode;
            }
        }

        return array_values(array_unique($codes));
    }

    private function hasCollaborativeOperation(
        PermissionDataIsolation $permissionIsolation,
        string $agentCode,
        string $userId
    ): bool {
        $operationMap = $this->operationPermissionDomainService->getResourceOperationByUserIds(
            $permissionIsolation,
            OperationPermissionResourceType::CustomAgent,
            [$userId],
            [$agentCode]
        );

        return ($operationMap[$userId][$agentCode] ?? Operation::None) !== Operation::None;
    }

    /** @return string[] */
    private function getMarketShelfIds(PermissionDataIsolation $permissionIsolation, string $userId): array
    {
        return $this->resourceVisibilityDomainService->getUserAccessibleResourceCodes(
            $permissionIsolation,
            $userId,
            ResourceVisibilityResourceType::SUPER_MAGIC_AGENT_MARKET,
        );
    }

    private function isMarketShelfVisible(
        PermissionDataIsolation $permissionIsolation,
        string $userId,
        ?int $marketId
    ): bool {
        if ($marketId === null) {
            return false;
        }

        return in_array((string) $marketId, $this->resourceVisibilityDomainService->getUserAccessibleResourceCodes(
            $permissionIsolation,
            $userId,
            ResourceVisibilityResourceType::SUPER_MAGIC_AGENT_MARKET,
            [(string) $marketId]
        ), true);
    }

    private function isVersionMemberTarget(
        PermissionDataIsolation $permissionIsolation,
        AgentVersionEntity $version,
        string $userId
    ): bool {
        $target = $version->getPublishTargetValue();
        if ($target === null) {
            return false;
        }
        if (in_array($userId, $target->getUserIds(), true)) {
            return true;
        }

        $targetDepartmentIds = $target->getDepartmentIds();
        if ($targetDepartmentIds === []) {
            return false;
        }

        $departmentIdsByUser = $this->departmentUserRepository->getDepartmentIdsByUserIds(
            ContactDataIsolation::create($permissionIsolation->getCurrentOrganizationCode(), $userId),
            [$userId],
            true
        );

        return array_intersect($targetDepartmentIds, $departmentIdsByUser[$userId] ?? []) !== [];
    }
}
