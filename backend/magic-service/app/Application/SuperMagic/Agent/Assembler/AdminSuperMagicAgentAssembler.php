<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Agent\Assembler;

use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\OrganizationEnvironment\Entity\OrganizationEntity;
use App\Domain\OrganizationEnvironment\Service\OrganizationDomainService;
use App\Domain\SuperMagic\Agent\Entity\AgentCategoryEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentMarketEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentVersionEntity;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentCategoryDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\SuperMagic\Agent\DTO\Response\AgentMarketListItemAdminDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\AgentVersionListItemAdminDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\QueryAgentMarketsResponseAdminDTO;
use App\Interfaces\SuperMagic\Agent\DTO\Response\QueryAgentVersionsResponseAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\OrganizationInfoAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\PublisherInfoAdminDTO;
use Throwable;

/**
 * 管理后台 Agent 装配器：版本列表等.
 */
class AdminSuperMagicAgentAssembler
{
    public function __construct(
        private readonly MagicUserDomainService $magicUserDomainService,
        private readonly OrganizationDomainService $organizationDomainService,
        private readonly SuperMagicAgentCategoryDomainService $categoryDomainService,
    ) {
    }

    /**
     * @param AgentVersionEntity[] $versions
     */
    public function createQueryVersionsResponseDTO(
        array $versions,
        Page $page,
        int $total,
        array $publishTargetUserMap = [],
        array $memberDepartmentMap = []
    ): QueryAgentVersionsResponseAdminDTO {
        $publisherUserMap = $this->buildPublisherUserMap($versions);
        $organizationMap = $this->buildOrganizationMap($versions);

        $list = array_map(
            fn (AgentVersionEntity $entity) => $this->createVersionListItemDTO(
                $entity,
                $publisherUserMap,
                $organizationMap,
                $publishTargetUserMap,
                $memberDepartmentMap
            ),
            $versions
        );

        return new QueryAgentVersionsResponseAdminDTO(
            list: $list,
            page: $page->getPage(),
            pageSize: $page->getPageNum(),
            total: $total
        );
    }

    /**
     * @param AgentMarketEntity[] $markets
     */
    public function createQueryMarketsResponseDTO(
        array $markets,
        Page $page,
        int $total
    ): QueryAgentMarketsResponseAdminDTO {
        $publisherUserMap = $this->buildPublisherUserMapByMarket($markets);
        $organizationMap = $this->buildOrganizationMapByMarket($markets);
        $categoryMap = $this->buildCategoryMapByMarket($markets);

        $list = array_map(
            fn (AgentMarketEntity $entity) => $this->createMarketListItemDTO($entity, $publisherUserMap, $organizationMap, $categoryMap),
            $markets
        );

        return new QueryAgentMarketsResponseAdminDTO(
            list: $list,
            page: $page->getPage(),
            pageSize: $page->getPageNum(),
            total: $total
        );
    }

    /**
     * @param AgentVersionEntity[] $entities
     * @return array<string, MagicUserEntity>
     */
    private function buildPublisherUserMap(array $entities): array
    {
        $publisherUserIds = array_values(array_unique(array_filter(array_map(
            static fn (AgentVersionEntity $entity) => $entity->getPublisherUserId(),
            $entities
        ))));

        if ($publisherUserIds === []) {
            return [];
        }

        try {
            $userEntities = $this->magicUserDomainService->getUserByIdsWithoutOrganization($publisherUserIds);
        } catch (Throwable) {
            return [];
        }

        $publisherUserMap = [];
        foreach ($userEntities as $userEntity) {
            $publisherUserMap[$userEntity->getUserId()] = $userEntity;
        }

        return $publisherUserMap;
    }

    /**
     * @param AgentMarketEntity[] $entities
     * @return array<string, MagicUserEntity>
     */
    private function buildPublisherUserMapByMarket(array $entities): array
    {
        $publisherUserIds = array_values(array_unique(array_filter(array_map(
            static fn (AgentMarketEntity $entity) => $entity->getPublisherId(),
            $entities
        ))));

        if ($publisherUserIds === []) {
            return [];
        }

        try {
            $userEntities = $this->magicUserDomainService->getUserByIdsWithoutOrganization($publisherUserIds);
        } catch (Throwable) {
            return [];
        }

        $publisherUserMap = [];
        foreach ($userEntities as $userEntity) {
            $publisherUserMap[$userEntity->getUserId()] = $userEntity;
        }

        return $publisherUserMap;
    }

    /**
     * @param AgentVersionEntity[] $entities
     * @return array<string, OrganizationEntity>
     */
    private function buildOrganizationMap(array $entities): array
    {
        $organizationCodes = array_values(array_unique(array_filter(array_map(
            static fn (AgentVersionEntity $entity) => $entity->getOrganizationCode(),
            $entities
        ))));

        if ($organizationCodes === []) {
            return [];
        }

        return $this->organizationDomainService->getByCodes($organizationCodes);
    }

    /**
     * @param AgentMarketEntity[] $entities
     * @return array<string, OrganizationEntity>
     */
    private function buildOrganizationMapByMarket(array $entities): array
    {
        $organizationCodes = array_values(array_unique(array_filter(array_map(
            static fn (AgentMarketEntity $entity) => $entity->getOrganizationCode(),
            $entities
        ))));

        if ($organizationCodes === []) {
            return [];
        }

        return $this->organizationDomainService->getByCodes($organizationCodes);
    }

    /**
     * @param AgentMarketEntity[] $entities
     * @return array<int, AgentCategoryEntity>
     */
    private function buildCategoryMapByMarket(array $entities): array
    {
        $categoryIds = [];
        foreach ($entities as $entity) {
            $categoryIds = array_merge($categoryIds, $entity->getCategoryIds());
        }
        $categoryIds = array_values(array_unique(array_filter($categoryIds)));

        if ($categoryIds === []) {
            return [];
        }

        try {
            $categories = $this->categoryDomainService->findByIds($categoryIds);
        } catch (Throwable) {
            return [];
        }

        $categoryMap = [];
        foreach ($categories as $category) {
            if ($category->getId() !== null) {
                $categoryMap[$category->getId()] = $category;
            }
        }

        return $categoryMap;
    }

    /**
     * @param array<string, MagicUserEntity> $publisherUserMap
     * @param array<string, OrganizationEntity> $organizationMap
     * @param array<string, MagicUserEntity> $publishTargetUserMap
     * @param array<string, MagicDepartmentEntity> $memberDepartmentMap
     */
    private function createVersionListItemDTO(
        AgentVersionEntity $entity,
        array $publisherUserMap,
        array $organizationMap,
        array $publishTargetUserMap,
        array $memberDepartmentMap
    ): AgentVersionListItemAdminDTO {
        $publisher = PublisherInfoAdminDTO::empty();
        $publisherUserId = $entity->getPublisherUserId();
        if ($publisherUserId !== null && isset($publisherUserMap[$publisherUserId])) {
            $userEntity = $publisherUserMap[$publisherUserId];
            $publisher = new PublisherInfoAdminDTO(
                userId: $userEntity->getUserId(),
                nickname: $userEntity->getNickname() ?? ''
            );
        }

        $organizationCode = $entity->getOrganizationCode();
        $organizationEntity = $organizationMap[$organizationCode] ?? null;
        $organization = new OrganizationInfoAdminDTO(
            code: $organizationCode,
            name: $organizationEntity !== null ? $organizationEntity->getName() : ''
        );

        return new AgentVersionListItemAdminDTO(
            id: (string) ($entity->getId() ?? ''),
            organization: $organization,
            code: $entity->getCode(),
            nameI18n: $entity->getNameI18n() ?? [],
            roleI18n: $entity->getRoleI18n(),
            descriptionI18n: $entity->getDescriptionI18n(),
            version: $entity->getVersion(),
            publishStatus: $entity->getPublishStatus()->value,
            reviewStatus: $entity->getReviewStatus()->value,
            reviewRemark: $entity->getReviewRemark(),
            publishTargetType: $entity->getPublishTargetType()->value,
            publishTargetValue: $this->buildEnrichedPublishTargetValue($entity, $publishTargetUserMap, $memberDepartmentMap),
            type: $entity->getType(),
            isCurrentVersion: $entity->isCurrentVersion(),
            publisher: $publisher,
            createdAt: $entity->getCreatedAt() ?? '',
            publishedAt: $entity->getPublishedAt()
        );
    }

    /**
     * 构建 MEMBER 发布目标的用户和部门展示值.
     *
     * @param array<string, MagicUserEntity> $userMap
     * @param array<string, MagicDepartmentEntity> $memberDepartmentMap
     * @return null|array{users: array<array{id: string, name: string}>, departments: array<array{id: string, name: string}>}
     */
    private function buildEnrichedPublishTargetValue(
        AgentVersionEntity $version,
        array $userMap,
        array $memberDepartmentMap
    ): ?array {
        $targetValue = $version->getPublishTargetValue();
        if ($targetValue === null || ! $version->getPublishTargetType()->requiresTargetValue()) {
            return null;
        }

        $users = [];
        foreach ($targetValue->getUserIds() as $userId) {
            $userEntity = $userMap[$userId] ?? null;
            $users[] = [
                'id' => $userId,
                'name' => $userEntity?->getNickname() ?: $userId,
            ];
        }

        $departments = [];
        foreach ($targetValue->getDepartmentIds() as $departmentId) {
            $departmentEntity = $memberDepartmentMap[$departmentId] ?? null;
            $departments[] = [
                'id' => $departmentId,
                'name' => $departmentEntity?->getName() ?: $departmentId,
            ];
        }

        return [
            'users' => $users,
            'departments' => $departments,
        ];
    }

    /**
     * @param array<string, MagicUserEntity> $publisherUserMap
     * @param array<string, OrganizationEntity> $organizationMap
     * @param array<int, AgentCategoryEntity> $categoryMap
     */
    private function createMarketListItemDTO(
        AgentMarketEntity $entity,
        array $publisherUserMap,
        array $organizationMap,
        array $categoryMap
    ): AgentMarketListItemAdminDTO {
        $publisher = PublisherInfoAdminDTO::empty();
        $publisherUserId = $entity->getPublisherId();
        if ($publisherUserId !== '' && isset($publisherUserMap[$publisherUserId])) {
            $userEntity = $publisherUserMap[$publisherUserId];
            $publisher = new PublisherInfoAdminDTO(
                userId: $userEntity->getUserId(),
                nickname: $userEntity->getNickname() ?? ''
            );
        }

        $organizationCode = (string) ($entity->getOrganizationCode() ?? '');
        $organizationEntity = $organizationMap[$organizationCode] ?? null;
        $organization = new OrganizationInfoAdminDTO(
            code: $organizationCode,
            name: $organizationEntity !== null ? $organizationEntity->getName() : ''
        );

        return new AgentMarketListItemAdminDTO(
            id: (string) ($entity->getId() ?? ''),
            organization: $organization,
            agentCode: $entity->getAgentCode(),
            agentVersionId: (string) $entity->getAgentVersionId(),
            nameI18n: $entity->getNameI18n() ?? [],
            roleI18n: $entity->getRoleI18n() ?? [],
            descriptionI18n: $entity->getDescriptionI18n() ?? [],
            icon: $entity->getIcon(),
            iconType: $entity->getIconType()->value,
            publisherId: $entity->getPublisherId(),
            publisherType: $entity->getPublisherType()->value,
            categoryIds: $entity->getCategoryIds(),
            categories: $this->createCategoryInfos($entity->getCategoryIds(), $categoryMap),
            publishStatus: $entity->getPublishStatus()->value,
            installCount: $entity->getInstallCount(),
            sortOrder: $entity->getSortOrder(),
            isFeatured: $entity->isFeatured(),
            isHidden: $entity->isHidden(),
            publisher: $publisher,
            createdAt: $entity->getCreatedAt(),
            updatedAt: $entity->getUpdatedAt()
        );
    }

    /**
     * @param int[] $categoryIds
     * @param array<int, AgentCategoryEntity> $categoryMap
     * @return array<int, array{id: string, name_i18n: array, logo: ?string, status: int}>
     */
    private function createCategoryInfos(array $categoryIds, array $categoryMap): array
    {
        $items = [];
        foreach ($categoryIds as $categoryId) {
            $entity = $categoryMap[$categoryId] ?? null;
            if ($entity === null) {
                continue;
            }
            $items[] = [
                'id' => (string) ($entity->getId() ?? ''),
                'name_i18n' => $entity->getNameI18n(),
                'logo' => $entity->getLogo(),
                'status' => $entity->getStatus(),
            ];
        }

        return $items;
    }
}
