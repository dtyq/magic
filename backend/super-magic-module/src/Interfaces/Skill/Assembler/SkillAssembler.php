<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\Assembler;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Infrastructure\Util\Context\CoContext;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillMarketEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublisherType;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\LatestPublishedSkillVersionItemDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\LatestPublishedSkillVersionsResponseDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\PublishSkillResponseDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\QuerySkillVersionsResponseDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillDetailResponseDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillListItemDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillListResponseDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillMarketListItemDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillMarketListResponseDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillVersionListItemDTO;

class SkillAssembler
{
    /**
     * 创建技能列表项 DTO.
     *
     * @param SkillEntity $entity 技能实体
     * @return SkillListItemDTO 技能列表项 DTO
     */
    public static function createListItemDTO(
        SkillEntity $entity,
        ?MagicUserEntity $creator = null,
        string $latestVersion = ''
    ): SkillListItemDTO {
        $language = CoContext::getLanguage();
        $nameI18n = $entity->getNameI18n() ?? [];
        $descriptionI18n = $entity->getDescriptionI18n() ?? [];
        $name = $entity->getI18nName($language);
        $description = $entity->getI18nDescription($language);

        return new SkillListItemDTO(
            id: $entity->getCode(),
            code: $entity->getCode(),
            name: $name,
            description: $description,
            nameI18n: $nameI18n,
            descriptionI18n: $descriptionI18n,
            logo: $entity->getLogo() ?? '',
            sourceType: $entity->getSourceType()->value,
            isEnabled: $entity->getIsEnabled() ? 1 : 0,
            pinnedAt: $entity->getPinnedAt(),
            updatedAt: $entity->getUpdatedAt() ?? '',
            createdAt: $entity->getCreatedAt() ?? '',
            latestPublishedAt: $entity->getLatestPublishedAt(),
            latestVersion: $latestVersion,
            creatorInfo: OperatorAssembler::createOperatorDTOByUserEntity($creator, $entity->getCreatedAt())
        );
    }

    public static function createListItemDTOFromVersion(
        SkillVersionEntity $entity,
        ?string $sourceType = null,
        ?MagicUserEntity $creator = null,
        ?string $latestVersion = null
    ): SkillListItemDTO {
        $language = CoContext::getLanguage();
        $nameI18n = $entity->getNameI18n() ?? [];
        $descriptionI18n = $entity->getDescriptionI18n() ?? [];
        $name = $nameI18n[$language] ?? '';
        $description = $descriptionI18n[$language] ?? '';

        return new SkillListItemDTO(
            id: $entity->getCode(),
            code: $entity->getCode(),
            name: $name,
            description: $description,
            nameI18n: $nameI18n,
            descriptionI18n: $descriptionI18n,
            logo: $entity->getLogo() ?? '',
            sourceType: $sourceType ?? $entity->getSourceType()->value,
            isEnabled: 1,
            pinnedAt: null,
            updatedAt: $entity->getUpdatedAt() ?? '',
            createdAt: $entity->getCreatedAt() ?? '',
            latestPublishedAt: $entity->getPublishedAt(),
            latestVersion: $latestVersion ?? $entity->getVersion(),
            creatorInfo: OperatorAssembler::createOperatorDTOByUserEntity($creator, $entity->getCreatedAt())
        );
    }

    public static function createDetailResponseDTO(SkillEntity $entity, bool $withFileUrl = false): SkillDetailResponseDTO
    {
        return new SkillDetailResponseDTO(
            $entity->getId() ?? 0,
            $entity->getCode(),
            $entity->getVersionId(),
            $entity->getVersionCode(),
            $entity->getSourceType()->value,
            $entity->getIsEnabled() ? 1 : 0,
            $entity->getPinnedAt(),
            $entity->getNameI18n(),
            $entity->getDescriptionI18n() ?? [],
            $entity->getLogo() ?? '',
            $entity->getPackageName(),
            $entity->getPackageDescription(),
            $withFileUrl ? $entity->getFileKey() : '',
            $withFileUrl ? ($entity->getFileUrl() ?? '') : '',
            $entity->getSourceId(),
            $entity->getSourceMeta(),
            $entity->getProjectId(),
            $entity->getLatestPublishedAt(),
            $entity->getCreatedAt() ?? '',
            $entity->getUpdatedAt() ?? ''
        );
    }

    /**
     * 创建市场技能列表项 DTO.
     *
     * @param SkillMarketEntity $entity 市场技能实体
     * @param bool $isAdded 是否已添加
     * @param bool $needUpgrade 是否需要升级
     * @param array $publisher 发布者信息
     * @return SkillMarketListItemDTO 市场技能列表项 DTO
     */
    public static function createMarketListItemDTO(
        SkillMarketEntity $entity,
        bool $isAdded = false,
        bool $needUpgrade = false,
        bool $isCurrentUserCreator = false,
        array $publisher = []
    ): SkillMarketListItemDTO {
        $language = CoContext::getLanguage();
        $nameI18n = $entity->getNameI18n() ?? [];
        $descriptionI18n = $entity->getDescriptionI18n() ?? [];
        $name = $entity->getI18nName($language);
        $description = $entity->getI18nDescription($language);

        return new SkillMarketListItemDTO(
            id: $entity->getId() ?? 0,
            skillCode: $entity->getSkillCode(),
            userSkillCode: $entity->getSkillCode(),
            name: $name,
            description: $description,
            nameI18n: $nameI18n,
            descriptionI18n: $descriptionI18n,
            logo: $entity->getLogo() ?? '',
            publisherType: $entity->getPublisherType()->value,
            publisher: $publisher,
            publishStatus: $entity->getPublishStatus()->value,
            isAdded: $isAdded,
            needUpgrade: $needUpgrade,
            isCreator: $isCurrentUserCreator,
            createdAt: $entity->getCreatedAt() ?? '',
            updatedAt: $entity->getUpdatedAt() ?? ''
        );
    }

    /**
     * 创建技能列表响应 DTO.
     *
     * @param SkillEntity[] $skillEntities 技能实体数组
     * @param int $page 当前页码
     * @param int $pageSize 每页数量
     * @param int $total 总记录数
     * @return SkillListResponseDTO 技能列表响应 DTO
     */
    public static function createListResponseDTO(
        array $skillEntities,
        int $page,
        int $pageSize,
        int $total,
        array $creatorUserMap = [],
        array $latestVersionMap = []
    ): SkillListResponseDTO {
        $listItems = [];
        foreach ($skillEntities as $entity) {
            $listItems[] = self::createListItemDTO(
                $entity,
                $creatorUserMap[$entity->getCreatorId()] ?? null,
                $latestVersionMap[$entity->getCode()] ?? ''
            );
        }

        return new SkillListResponseDTO(
            list: $listItems,
            page: $page,
            pageSize: $pageSize,
            total: $total
        );
    }

    /**
     * @param SkillVersionEntity[] $skillVersionEntities
     */
    public static function createListResponseDTOFromVersions(
        array $skillVersionEntities,
        int $page,
        int $pageSize,
        int $total,
        ?string $sourceType = null,
        array $creatorUserMap = [],
        array $latestVersionMap = []
    ): SkillListResponseDTO {
        $listItems = [];
        foreach ($skillVersionEntities as $entity) {
            $listItems[] = self::createListItemDTOFromVersion(
                $entity,
                $sourceType,
                $creatorUserMap[$entity->getCreatorId()] ?? null,
                $latestVersionMap[$entity->getCode()] ?? $entity->getVersion()
            );
        }

        return new SkillListResponseDTO(
            list: $listItems,
            page: $page,
            pageSize: $pageSize,
            total: $total
        );
    }

    public static function createPublishVersionResponseDTO(SkillVersionEntity $version): PublishSkillResponseDTO
    {
        return new PublishSkillResponseDTO(
            versionId: (string) $version->getId(),
            version: $version->getVersion(),
            publishStatus: $version->getPublishStatus()->value,
            reviewStatus: $version->getReviewStatus()->value ?? '',
            publishTargetType: $version->getPublishTargetType()->value,
            isCurrentVersion: $version->isCurrentVersion(),
            publishedAt: $version->getPublishedAt(),
        );
    }

    /**
     * @param SkillVersionEntity[] $versions
     */
    public static function createLatestPublishedVersionsResponseDTO(
        array $versions,
        int $page,
        int $pageSize,
        int $total,
        bool $withFileUrl = false,
    ): LatestPublishedSkillVersionsResponseDTO {
        $language = CoContext::getLanguage();
        $list = [];

        foreach ($versions as $version) {
            $list[] = new LatestPublishedSkillVersionItemDTO(
                id: (string) $version->getId(),
                code: $version->getCode(),
                version: $version->getVersion(),
                name: $version->getNameI18n()[$language] ?? '',
                description: $version->getDescriptionI18n()[$language] ?? '',
                nameI18n: $version->getNameI18n(),
                descriptionI18n: $version->getDescriptionI18n(),
                logo: $version->getLogo() ?? '',
                fileKey: $withFileUrl ? $version->getFileKey() : null,
                fileUrl: $withFileUrl ? $version->getFileUrl() : null,
                sourceType: $version->getSourceType()->value,
                publishStatus: $version->getPublishStatus()->value,
                reviewStatus: $version->getReviewStatus()?->value,
                publishTargetType: $version->getPublishTargetType()->value,
                publishedAt: $version->getPublishedAt(),
                projectId: $version->getProjectId(),
                createdAt: $version->getCreatedAt(),
                updatedAt: $version->getUpdatedAt(),
            );
        }

        return new LatestPublishedSkillVersionsResponseDTO($list, $page, $pageSize, $total);
    }

    /**
     * @param array<string, MagicUserEntity> $users
     * @param SkillVersionEntity[] $versions
     */
    public static function createQuerySkillVersionsResponseDTO(
        array $versions,
        array $users,
        int $page,
        int $pageSize,
        int $total
    ): QuerySkillVersionsResponseDTO {
        $list = [];
        foreach ($versions as $version) {
            $list[] = new SkillVersionListItemDTO(
                id: (string) $version->getId(),
                version: $version->getVersion(),
                publishStatus: $version->getPublishStatus()->value,
                reviewStatus: $version->getReviewStatus()->value ?? '',
                publishTargetType: $version->getPublishTargetType()->value,
                publisher: OperatorAssembler::createOperatorDTOByUserEntity($users[$version->getPublisherUserId() ?? ''] ?? null, $version->getPublishedAt() ?? $version->getCreatedAt()),
                publishedAt: $version->getPublishedAt(),
                isCurrentVersion: $version->isCurrentVersion(),
                versionDescriptionI18n: $version->getVersionDescriptionI18n(),
            );
        }

        return new QuerySkillVersionsResponseDTO($list, $page, $pageSize, $total);
    }

    /**
     * 创建市场技能列表响应 DTO.
     *
     * @param array<string, SkillEntity> $userSkills 用户已添加的技能映射（key 为 skillCode）
     * @param array<string, MagicUserEntity> $publisherUserMap 发布者用户信息映射（key 为 publisherId）
     * @param int $page 当前页码
     * @param int $pageSize 每页数量
     * @param int $total 总记录数
     * @return SkillMarketListResponseDTO 市场技能列表响应 DTO
     */
    public static function createMarketListResponseDTO(
        array $skillMarketEntities,
        array $userSkills,
        array $publisherUserMap,
        array $creatorSkillCodes,
        int $page,
        int $pageSize,
        int $total
    ): SkillMarketListResponseDTO {
        $listItems = [];
        foreach ($skillMarketEntities as $skillMarketEntity) {
            $skillCode = $skillMarketEntity->getSkillCode();
            $userSkill = $userSkills[$skillCode] ?? null;

            // 判断 is_added
            $isAdded = $userSkill !== null;

            // 判断 need_upgrade（仅当 is_added = true 且 source_type = 'STORE' 时有效）
            $needUpgrade = false;
            if ($isAdded && $userSkill && $userSkill->getSourceType()->isMarket()) {
                // 比较用户的 version_id 和商店的 skill_version_id
                $needUpgrade = $userSkill->getVersionId() !== $skillMarketEntity->getSkillVersionId();
            }

            // 构建 publisher 对象
            $publisher = self::buildPublisher(
                $skillMarketEntity->getPublisherType(),
                $skillMarketEntity->getPublisherId(),
                $publisherUserMap[$skillMarketEntity->getPublisherId()] ?? null
            );

            $isCreator = $creatorSkillCodes[$skillCode] ?? false;
            $isAdded = $isCreator ?: $isAdded;

            $listItems[] = self::createMarketListItemDTO(
                $skillMarketEntity,
                $isAdded,
                $needUpgrade,
                $isCreator,
                $publisher
            );
        }

        return new SkillMarketListResponseDTO(
            list: $listItems,
            page: $page,
            pageSize: $pageSize,
            total: $total
        );
    }

    /**
     * 构建发布者信息对象.
     *
     * @param PublisherType $publisherType 发布者类型
     * @param string $publisherId 发布者ID
     * @param null|MagicUserEntity $userEntity 用户实体（如果已批量查询）
     * @return array{name: string, avatar: string} 发布者信息
     */
    private static function buildPublisher(PublisherType $publisherType, string $publisherId, ?MagicUserEntity $userEntity = null): array
    {
        // 官方类型，头像为空
        if ($publisherType === PublisherType::OFFICIAL) {
            return [
                'name' => PublisherType::OFFICIAL->value,
                'avatar' => '',
            ];
        }

        // 如果有用户实体，使用用户信息
        if ($userEntity !== null) {
            return [
                'name' => $userEntity->getNickname() ?? PublisherType::USER->value,
                'avatar' => $userEntity->getAvatarUrl() ?? '',
            ];
        }

        // 如果没有用户实体，返回默认值（理论上不应该走到这里，因为已经批量查询了）
        return [
            'name' => PublisherType::USER->value,
            'avatar' => '',
        ];
    }
}
