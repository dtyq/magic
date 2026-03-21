<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Skill\Assembler;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\PublisherInfoAdminDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\QuerySkillVersionsResponseAdminDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillVersionListItemAdminDTO;
use Throwable;

/**
 * 管理后台 Skill 装配器.
 * 负责补全发布者信息并组装管理后台响应 DTO.
 */
class AdminSkillAssembler
{
    public function __construct(
        private readonly MagicUserDomainService $magicUserDomainService,
    ) {
    }

    /**
     * @param SkillVersionEntity[] $versions
     */
    public function createQueryVersionsResponseDTO(
        array $versions,
        Page $page,
        int $total
    ): QuerySkillVersionsResponseAdminDTO {
        $publisherUserMap = $this->buildPublisherUserMap($versions);

        $list = array_map(
            fn (SkillVersionEntity $entity) => $this->createListItemDTO($entity, $publisherUserMap),
            $versions
        );

        return new QuerySkillVersionsResponseAdminDTO(
            list: $list,
            page: $page->getPage(),
            pageSize: $page->getPageNum(),
            total: $total
        );
    }

    /**
     * @param SkillVersionEntity[] $skillVersionEntities
     * @return array<string, MagicUserEntity>
     */
    private function buildPublisherUserMap(array $skillVersionEntities): array
    {
        $publisherUserIds = array_values(array_unique(array_filter(array_map(
            static fn (SkillVersionEntity $skillVersionEntity) => $skillVersionEntity->getPublisherUserId(),
            $skillVersionEntities
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
     * @param array<string, MagicUserEntity> $publisherUserMap
     */
    private function createListItemDTO(SkillVersionEntity $entity, array $publisherUserMap): SkillVersionListItemAdminDTO
    {
        $publisher = PublisherInfoAdminDTO::empty();
        $publisherUserId = $entity->getPublisherUserId();
        if ($publisherUserId !== null && isset($publisherUserMap[$publisherUserId])) {
            $userEntity = $publisherUserMap[$publisherUserId];
            $publisher = new PublisherInfoAdminDTO(
                userId: $userEntity->getUserId(),
                nickname: $userEntity->getNickname() ?? ''
            );
        }

        return new SkillVersionListItemAdminDTO(
            id: (string) ($entity->getId() ?? ''),
            code: $entity->getCode(),
            packageName: $entity->getPackageName(),
            nameI18n: $entity->getNameI18n(),
            descriptionI18n: $entity->getDescriptionI18n() ?? [],
            version: $entity->getVersion(),
            publishStatus: $entity->getPublishStatus()->value,
            reviewStatus: $entity->getReviewStatus()?->value ?? '',
            publishTargetType: $entity->getPublishTargetType()->value,
            sourceType: $entity->getSourceType()->value,
            publisher: $publisher,
            createdAt: $entity->getCreatedAt() ?? '',
            publishedAt: $entity->getPublishedAt()
        );
    }
}
