<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Assembler;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\OrganizationEnvironment\Entity\OrganizationEntity;
use App\Domain\OrganizationEnvironment\Service\OrganizationDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentMarketEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentVersionEntity;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\AgentMarketListItemAdminDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\AgentVersionListItemAdminDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\QueryAgentMarketsResponseAdminDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\QueryAgentVersionsResponseAdminDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\OrganizationInfoAdminDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\PublisherInfoAdminDTO;
use Throwable;

/**
 * 管理后台 Agent 装配器：版本列表等.
 */
class AdminSuperMagicAgentAssembler
{
    public function __construct(
        private readonly MagicUserDomainService $magicUserDomainService,
        private readonly OrganizationDomainService $organizationDomainService,
    ) {
    }

    /**
     * @param AgentVersionEntity[] $versions
     */
    public function createQueryVersionsResponseDTO(
        array $versions,
        Page $page,
        int $total
    ): QueryAgentVersionsResponseAdminDTO {
        $publisherUserMap = $this->buildPublisherUserMap($versions);
        $organizationMap = $this->buildOrganizationMap($versions);

        $list = array_map(
            fn (AgentVersionEntity $entity) => $this->createVersionListItemDTO($entity, $publisherUserMap, $organizationMap),
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

        $list = array_map(
            fn (AgentMarketEntity $entity) => $this->createMarketListItemDTO($entity, $publisherUserMap, $organizationMap),
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
     * @param array<string, MagicUserEntity> $publisherUserMap
     * @param array<string, OrganizationEntity> $organizationMap
     */
    private function createVersionListItemDTO(
        AgentVersionEntity $entity,
        array $publisherUserMap,
        array $organizationMap
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
            publishTargetType: $entity->getPublishTargetType()->value,
            type: $entity->getType(),
            isCurrentVersion: $entity->isCurrentVersion(),
            publisher: $publisher,
            createdAt: $entity->getCreatedAt() ?? '',
            publishedAt: $entity->getPublishedAt()
        );
    }

    /**
     * @param array<string, MagicUserEntity> $publisherUserMap
     * @param array<string, OrganizationEntity> $organizationMap
     */
    private function createMarketListItemDTO(
        AgentMarketEntity $entity,
        array $publisherUserMap,
        array $organizationMap
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
            categoryId: $entity->getCategoryId(),
            publishStatus: $entity->getPublishStatus()->value,
            installCount: $entity->getInstallCount(),
            sortOrder: $entity->getSortOrder(),
            publisher: $publisher,
            createdAt: $entity->getCreatedAt(),
            updatedAt: $entity->getUpdatedAt()
        );
    }
}
