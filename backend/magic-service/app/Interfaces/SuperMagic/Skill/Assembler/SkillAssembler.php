<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Skill\Assembler;

use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\SuperMagic\Skill\Entity\SkillCategoryEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillMarketEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillVersionEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\PublisherType;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillSourceType;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use App\Infrastructure\Util\Context\CoContext;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\SuperMagic\Skill\DTO\Response\CategoryInfoDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\LatestPublishedSkillVersionItemDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\LatestPublishedSkillVersionsResponseDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\PublishSkillResponseDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\QuerySkillVersionsResponseDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\SkillDetailResponseDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\SkillListItemDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\SkillListResponseDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\SkillMarketDetailResponseDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\SkillMarketListItemDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\SkillMarketListResponseDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\SkillVersionListItemDTO;

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
        ?SkillVersionEntity $latestVersionEntity = null,
        ?Operation $operation = null,
        bool $includeI18n = false
    ): SkillListItemDTO {
        $language = self::getLanguage();

        $creatorInfo = [
            'id' => (string) ($creator?->getId() ?? ''),
            'name' => $creator?->getNickname() ?: '',
        ];

        return new SkillListItemDTO(
            id: $entity->getCode(),
            code: $entity->getCode(),
            projectId: $entity->getProjectId() === null ? null : (string) $entity->getProjectId(),
            name: $entity->getI18nName($language),
            description: $entity->getI18nDescription($language),
            source: $entity->getI18nSource($language),
            logo: $entity->getLogo() ?? '',
            sourceType: $entity->getSourceType()->value,
            isEnabled: $entity->getIsEnabled() ? 1 : 0,
            pinnedAt: $entity->getPinnedAt(),
            updatedAt: $entity->getUpdatedAt() ?? '',
            createdAt: $entity->getCreatedAt() ?? '',
            latestPublishedAt: $entity->getLatestPublishedAt(),
            latestVersion: $latestVersionEntity?->getVersion() ?? $entity->getVersionCode(),
            packageName: $entity->getPackageName(),
            creatorInfo: $creatorInfo,
            userRole: $operation?->toAlias(),
            nameI18n: $includeI18n ? ($entity->getNameI18n() ?? []) : null,
            descriptionI18n: $includeI18n ? ($entity->getDescriptionI18n() ?? []) : null,
            sourceI18n: $includeI18n ? ($entity->getSourceI18n() ?? []) : null,
        );
    }

    public static function createListItemDTOFromVersion(
        SkillVersionEntity $entity,
        ?string $sourceType = null,
        ?MagicUserEntity $creator = null,
        ?SkillVersionEntity $latestVersionEntity = null,
        ?string $publisherType = null,
        ?array $publisher = null,
        bool $includeI18n = false
    ): SkillListItemDTO {
        $language = self::getLanguage();

        $creatorInfo = [
            'id' => (string) ($creator?->getId() ?: ''),
            'name' => ($creator?->getNickname() ?: ''),
        ];

        return new SkillListItemDTO(
            id: $entity->getCode(),
            code: $entity->getCode(),
            projectId: $entity->getProjectId() === null ? null : (string) $entity->getProjectId(),
            name: $entity->getI18nName($language),
            description: $entity->getI18nDescription($language),
            source: $entity->getI18nSource($language),
            logo: $entity->getLogo() ?? '',
            sourceType: $sourceType ?? $entity->getSourceType()->value,
            isEnabled: 1,
            pinnedAt: null,
            updatedAt: $entity->getUpdatedAt() ?? '',
            createdAt: $entity->getCreatedAt() ?? '',
            latestPublishedAt: $entity->getPublishedAt(),
            latestVersion: $latestVersionEntity?->getVersion() ?? $entity->getVersion(),
            packageName: $entity->getPackageName(),
            creatorInfo: $creatorInfo,
            publisherType: $publisherType,
            publisher: $publisher,
            nameI18n: $includeI18n ? ($entity->getNameI18n() ?? []) : null,
            descriptionI18n: $includeI18n ? ($entity->getDescriptionI18n() ?? []) : null,
            sourceI18n: $includeI18n ? ($entity->getSourceI18n() ?? []) : null,
        );
    }

    public static function createDetailResponseDTO(SkillEntity $entity, bool $withFileUrl = false): SkillDetailResponseDTO
    {
        $language = self::getLanguage();

        return new SkillDetailResponseDTO(
            $entity->getId() ?? 0,
            $entity->getCode(),
            $entity->getVersionId(),
            $entity->getVersionCode(),
            $entity->getSourceType()->value,
            $entity->getIsEnabled() ? 1 : 0,
            $entity->getPinnedAt(),
            $entity->getI18nName($language),
            $entity->getI18nDescription($language),
            $entity->getI18nSource($language),
            $entity->getNameI18n(),
            $entity->getDescriptionI18n() ?? [],
            $entity->getSourceI18n() ?? [],
            $entity->getLogo() ?? '',
            $entity->getPackageName(),
            $entity->getPackageDescription(),
            $withFileUrl ? $entity->getFileKey() : '',
            $withFileUrl ? ($entity->getFileUrl() ?? '') : '',
            $entity->getSourceId(),
            $entity->getSourceMeta(),
            $entity->getProjectId(),
            $entity->getLatestPublishedAt(),
            null,
            [],
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
     * @param string $fileKey 版本文件 key
     * @param null|string $fileUrl 版本文件下载 URL
     * @param null|SkillVersionEntity $version 关联的技能版本，用于补齐来源、包名与版本信息
     * @param null|string $language 语言代码，不传时从上下文读取
     * @return SkillMarketListItemDTO 响应含 `code`；`skill_code`/`user_skill_code` 为兼容字段（与 `code` 同值）
     */
    public static function createMarketListItemDTO(
        SkillMarketEntity $entity,
        bool $isAdded = false,
        bool $needUpgrade = false,
        bool $isCurrentUserCreator = false,
        array $publisher = [],
        string $fileKey = '',
        ?string $fileUrl = null,
        string $packageName = '',
        string $latestVersion = '',
        ?SkillVersionEntity $version = null,
        ?string $language = null,
    ): SkillMarketListItemDTO {
        $language ??= self::getLanguage();

        return new SkillMarketListItemDTO(
            id: $entity->getId() ?? 0,
            skillCode: $entity->getSkillCode(),
            userSkillCode: $entity->getSkillCode(),
            name: $entity->getI18nName($language),
            description: $entity->getI18nDescription($language),
            source: $version?->getI18nSource($language) ?? '',
            logo: $entity->getLogo() ?? '',
            publisherType: $entity->getPublisherType()->value,
            publisher: $publisher,
            publishStatus: $entity->getPublishStatus()->value,
            isAdded: $isAdded,
            needUpgrade: $needUpgrade,
            isCreator: $isCurrentUserCreator,
            isFeatured: $entity->isFeatured(),
            createdAt: $entity->getCreatedAt() ?? '',
            updatedAt: $entity->getUpdatedAt() ?? '',
            fileKey: $fileKey,
            fileUrl: $fileUrl,
            packageName: $packageName,
            latestVersion: $latestVersion,
            installCount: $entity->getTotalInstallCount(),
            totalInstallCount: $entity->getTotalInstallCount(),
        );
    }

    /**
     * 创建技能列表响应 DTO.
     *
     * @param int $page 当前页码
     * @param int $total 总记录数
     * @return SkillListResponseDTO 技能列表响应 DTO
     */
    public static function createListResponseDTO(
        array $skillEntities,
        int $page,
        int $pageSize,
        int $total,
        array $creatorUserMap = [],
        array $latestVersionMap = [],
        array $skillOperations = [],
        bool $includeI18n = false,
    ): SkillListResponseDTO {
        $listItems = [];
        foreach ($skillEntities as $entity) {
            $listItems[] = self::createListItemDTO(
                $entity,
                $creatorUserMap[$entity->getCreatorId()] ?? null,
                $latestVersionMap[$entity->getCode()] ?? null,
                $skillOperations[$entity->getCode()] ?? null,
                $includeI18n,
            );
        }

        return new SkillListResponseDTO(
            list: $listItems,
            page: $page,
            pageSize: $pageSize,
            total: $total
        );
    }

    public static function createListResponseDTOFromVersions(
        array $skillVersionEntities,
        int $page,
        int $pageSize,
        int $total,
        ?string $sourceType = null,
        array $creatorUserMap = [],
        array $latestVersionMap = [],
        array $marketEntityMap = [],
        array $publisherUserMap = [],
        bool $includeI18n = false
    ): SkillListResponseDTO {
        $listItems = [];
        foreach ($skillVersionEntities as $entity) {
            $publisherType = null;
            $publisher = null;

            $marketEntity = $marketEntityMap[$entity->getCode()] ?? null;
            if ($marketEntity instanceof SkillMarketEntity) {
                $publisherType = $marketEntity->getPublisherType()->value;
                $publisher = self::buildPublisher(
                    $marketEntity->getPublisherType(),
                    $marketEntity->getPublisherId(),
                    $publisherUserMap[$marketEntity->getPublisherId()] ?? null
                );
            }

            $listItems[] = self::createListItemDTOFromVersion(
                $entity,
                self::resolveListSourceType($entity, $marketEntity, $sourceType),
                $creatorUserMap[$entity->getCreatorId()] ?? null,
                $latestVersionMap[$entity->getCode()] ?? null,
                $publisherType,
                $publisher,
                $includeI18n
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
            categoryIds: $version->getCategoryIds(),
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
        $language = self::getLanguage();
        $list = [];

        foreach ($versions as $version) {
            $list[] = new LatestPublishedSkillVersionItemDTO(
                id: (string) $version->getId(),
                code: $version->getCode(),
                packageName: $version->getPackageName(),
                version: $version->getVersion(),
                name: $version->getI18nName($language),
                description: $version->getI18nDescription($language),
                nameI18n: $version->getNameI18n(),
                descriptionI18n: $version->getDescriptionI18n() ?: [],
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
     * @param SkillVersionEntity[] $versions
     */
    public static function createQuerySkillVersionsResponseDTO(
        array $versions,
        array $userMap,
        int $page,
        int $pageSize,
        int $total,
        array $memberDepartmentMap = [],
        array $categoryMap = [],
    ): QuerySkillVersionsResponseDTO {
        $language = self::getLanguage();
        $list = [];
        foreach ($versions as $version) {
            $enrichedPublishTargetValue = self::buildEnrichedPublishTargetValue(
                $version,
                $userMap,
                $memberDepartmentMap
            );

            $list[] = new SkillVersionListItemDTO(
                id: (string) $version->getId(),
                version: $version->getVersion(),
                publishStatus: $version->getPublishStatus()->value,
                reviewStatus: $version->getReviewStatus()->value ?? '',
                reviewRemark: $version->getReviewRemark(),
                publishTargetType: $version->getPublishTargetType()->value,
                publisher: OperatorAssembler::createOperatorDTOByUserEntity($userMap[$version->getPublisherUserId() ?? ''] ?? null, $version->getPublishedAt() ?? $version->getCreatedAt()),
                publishedAt: $version->getPublishedAt(),
                isCurrentVersion: $version->isCurrentVersion(),
                versionDescriptionI18n: $version->getVersionDescriptionI18n(),
                versionDescription: $version->getI18nVersionDescription($language),
                publishTargetValue: $enrichedPublishTargetValue,
                categories: self::buildCategoryInfoDTOs($version, $categoryMap, $language),
            );
        }

        return new QuerySkillVersionsResponseDTO($list, $page, $pageSize, $total);
    }

    /**
     * 创建市场技能列表响应 DTO.
     *
     * @param array<string, SkillEntity> $userSkills 用户已添加的技能映射（key 为 skillCode）
     * @param array<string, MagicUserEntity> $publisherUserMap 发布者用户信息映射（key 为 publisherId）
     * @param array<string, SkillVersionEntity> $skillVersionMap key 为 skill_version_id（已解析 file_url）
     * @param int $page 当前页码
     * @param int $pageSize 每页数量
     * @param null|int $total 总记录数（不需要时传 null）
     * @return SkillMarketListResponseDTO 市场技能列表响应 DTO
     */
    public static function createMarketListResponseDTO(
        array $skillMarketEntities,
        array $userSkills,
        array $publisherUserMap,
        string $currentUserId,
        int $page,
        int $pageSize,
        ?int $total = null,
        array $skillVersionMap = []
    ): SkillMarketListResponseDTO {
        $listItems = self::createMarketListItems(
            $skillMarketEntities,
            $userSkills,
            $publisherUserMap,
            $currentUserId,
            $skillVersionMap
        );

        return new SkillMarketListResponseDTO(
            list: $listItems,
            page: $page,
            pageSize: $pageSize,
            total: $total
        );
    }

    /**
     * Build the market detail DTO from the market snapshot and version snapshot.
     */
    public static function createMarketDetailResponseDTO(
        SkillMarketEntity $skillMarket,
        SkillVersionEntity $skillVersion,
        bool $isAdded,
        bool $isCreator,
        ?MagicUserEntity $publisherUser = null,
        string $skillFileUrl = ''
    ): SkillMarketDetailResponseDTO {
        $language = self::getLanguage();
        $nameI18n = $skillMarket->getNameI18n() ?: $skillVersion->getNameI18n();
        $descriptionI18n = $skillMarket->getDescriptionI18n() ?: $skillVersion->getDescriptionI18n() ?: [];
        $sourceI18n = $skillVersion->getSourceI18n() ?: [];

        return new SkillMarketDetailResponseDTO(
            code: $skillMarket->getSkillCode(),
            name: $skillMarket->getI18nName($language) ?: $skillVersion->getI18nName($language),
            description: $skillMarket->getI18nDescription($language) ?: $skillVersion->getI18nDescription($language),
            source: $skillVersion->getI18nSource($language),
            nameI18n: $nameI18n,
            descriptionI18n: $descriptionI18n,
            sourceI18n: $sourceI18n,
            skillFileUrl: $skillFileUrl,
            versionCode: $skillVersion->getVersion(),
            packageName: $skillVersion->getPackageName(),
            versionCreatedAt: $skillVersion->getCreatedAt() ?? '',
            logo: $skillMarket->getLogo() ?? $skillVersion->getLogo() ?? '',
            publisherType: $skillMarket->getPublisherType()->value,
            publisher: self::buildPublisher(
                $skillMarket->getPublisherType(),
                $skillMarket->getPublisherId(),
                $publisherUser
            ),
            isAdded: $isAdded,
            isCreator: $isCreator,
            isFeatured: $skillMarket->isFeatured(),
            categoryIds: $skillMarket->getCategoryIds(),
        );
    }

    /**
     * @param array<int, SkillCategoryEntity> $categoryMap
     * @return CategoryInfoDTO[]
     */
    private static function buildCategoryInfoDTOs(SkillVersionEntity $version, array $categoryMap, string $language): array
    {
        $items = [];
        foreach ($version->getCategoryIds() as $categoryId) {
            $category = $categoryMap[$categoryId] ?? null;
            if ($category === null) {
                continue;
            }

            $items[] = new CategoryInfoDTO(
                id: (string) $categoryId,
                name: $category->getI18nName($language),
            );
        }

        return $items;
    }

    /**
     * 统一获取当前语言，空上下文时回退到多语言默认键.
     */
    private static function getLanguage(): string
    {
        return CoContext::getLanguage() ?: LanguageEnum::DEFAULT->value;
    }

    /**
     * 组装市场技能列表项.
     *
     * @param array<string, SkillEntity> $userSkills 用户已添加的技能映射（key 为 skillCode）
     * @param array<string, MagicUserEntity> $publisherUserMap 发布者用户信息映射（key 为 publisherId）
     * @param array<string, SkillVersionEntity> $skillVersionMap key 为 skill_code
     * @return SkillMarketListItemDTO[]
     */
    private static function createMarketListItems(
        array $skillMarketEntities,
        array $userSkills,
        array $publisherUserMap,
        string $currentUserId,
        array $skillVersionMap
    ): array {
        $listItems = [];
        $language = self::getLanguage();
        foreach ($skillMarketEntities as $skillMarketEntity) {
            $skillCode = $skillMarketEntity->getSkillCode();
            $userSkill = $userSkills[$skillCode] ?? null;
            $isBuiltinMarketSkill = $skillMarketEntity->getPublisherType()->isOfficialBuiltin();

            // 判断 is_added
            $isAdded = $isBuiltinMarketSkill || $userSkill !== null;

            // 判断 need_upgrade（仅当 is_added = true 且 source_type = 'STORE' 时有效）
            $needUpgrade = false;
            if (! $isBuiltinMarketSkill && $isAdded && $userSkill && $userSkill->getSourceType()->isMarket()) {
                // 比较用户的 version_id 和商店的 skill_version_id
                $needUpgrade = $userSkill->getVersionId() !== $skillMarketEntity->getSkillVersionId();
            }

            // 构建 publisher 对象
            $publisher = self::buildPublisher(
                $skillMarketEntity->getPublisherType(),
                $skillMarketEntity->getPublisherId(),
                $publisherUserMap[$skillMarketEntity->getPublisherId()] ?? null
            );

            $version = $skillVersionMap[$skillMarketEntity->getSkillCode()] ?? null;
            $isCreator = $version !== null && (string) $version->getCreatorId() === $currentUserId;
            $isAdded = $isCreator ?: $isAdded;
            $fileKey = (string) ($version?->getFileKey() ?? '');
            $fileUrl = $version?->getFileUrl();
            $packageName = (string) ($version?->getPackageName() ?? '');
            $latestVersion = (string) ($version?->getVersion() ?? '');

            $listItems[] = self::createMarketListItemDTO(
                $skillMarketEntity,
                $isAdded,
                $needUpgrade,
                $isCreator,
                $publisher,
                fileKey: $fileKey,
                fileUrl: $fileUrl,
                packageName: $packageName,
                latestVersion: $latestVersion,
                version: $version,
                language: $language,
            );
        }

        return $listItems;
    }

    /**
     * 构建 MEMBER 类型的 publishTargetValue enriched 数据.
     *
     * 仅当 publishTargetType 为 MEMBER 时才返回数据，其他类型返回 null。
     *
     * @param array<string, MagicUserEntity> $userMap
     * @param array<string, MagicDepartmentEntity> $memberDepartmentMap
     * @return null|array{users: array<array{id: string, name: string}>, departments: array<array{id: string, name: string}>}
     */
    private static function buildEnrichedPublishTargetValue(
        SkillVersionEntity $version,
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
     * 构建发布者信息对象.
     *
     * @param PublisherType $publisherType 发布者类型
     * @param string $publisherId 发布者ID
     * @param null|MagicUserEntity $userEntity 用户实体（如果已批量查询）
     * @return array{name: string, avatar: string} 发布者信息
     */
    private static function buildPublisher(PublisherType $publisherType, string $publisherId, ?MagicUserEntity $userEntity = null): array
    {
        // 如果有用户实体，使用用户信息
        if ($publisherType->isUser() && $userEntity) {
            return [
                'name' => $userEntity->getNickname() ?? PublisherType::USER->value,
                'avatar' => '',
            ];
        }

        return [
            'name' => $publisherType->getDescription(),
            'avatar' => '',
        ];
    }

    private static function resolveListSourceType(
        SkillVersionEntity $entity,
        ?SkillMarketEntity $marketEntity,
        ?string $defaultSourceType
    ): string {
        if ($defaultSourceType === null) {
            return $entity->getSourceType()->value;
        }

        if ($defaultSourceType === SkillSourceType::MARKET->value
            && $marketEntity instanceof SkillMarketEntity
            && $marketEntity->getPublisherType()->isOfficialBuiltin()) {
            return SkillSourceType::SYSTEM->value;
        }

        return $defaultSourceType;
    }
}
