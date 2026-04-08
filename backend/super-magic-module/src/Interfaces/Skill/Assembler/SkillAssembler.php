<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\Assembler;

use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use App\Infrastructure\Util\Context\CoContext;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillMarketEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublisherType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillSourceType;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\LatestPublishedSkillVersionItemDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\LatestPublishedSkillVersionsResponseDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\PublishSkillResponseDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\QuerySkillVersionsResponseDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillDetailResponseDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillListItemDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillListResponseDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillMarketDetailResponseDTO;
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
        $sourceI18n = $entity->getSourceI18n() ?? [];
        $name = $entity->getI18nName($language);
        $description = $entity->getI18nDescription($language);

        $creatorInfo = [
            'id' => (string) $creator->getId(),
            'name' => $creator->getNickname(),
        ];

        return new SkillListItemDTO(
            id: $entity->getCode(),
            code: $entity->getCode(),
            name: $name,
            description: $description,
            nameI18n: $nameI18n,
            descriptionI18n: $descriptionI18n,
            sourceI18n: $sourceI18n,
            logo: $entity->getLogo() ?? '',
            sourceType: $entity->getSourceType()->value,
            isEnabled: $entity->getIsEnabled() ? 1 : 0,
            pinnedAt: $entity->getPinnedAt(),
            updatedAt: $entity->getUpdatedAt() ?? '',
            createdAt: $entity->getCreatedAt() ?? '',
            latestPublishedAt: $entity->getLatestPublishedAt(),
            latestVersion: $latestVersion,
            packageName: $entity->getPackageName(),
            creatorInfo: $creatorInfo
        );
    }

    public static function createListItemDTOFromVersion(
        SkillVersionEntity $entity,
        ?string $sourceType = null,
        ?MagicUserEntity $creator = null,
        ?string $latestVersion = null,
        ?string $publisherType = null,
        ?array $publisher = null
    ): SkillListItemDTO {
        $language = CoContext::getLanguage();
        $nameI18n = $entity->getNameI18n() ?? [];
        $descriptionI18n = $entity->getDescriptionI18n() ?? [];
        $sourceI18n = $entity->getSourceI18n() ?? [];
        $name = $nameI18n[$language] ?? '';
        $description = $descriptionI18n[$language] ?? '';

        $creatorInfo = [
            'id' => (string) $creator->getId(),
            'name' => $creator->getNickname(),
        ];

        return new SkillListItemDTO(
            id: $entity->getCode(),
            code: $entity->getCode(),
            name: $name,
            description: $description,
            nameI18n: $nameI18n,
            descriptionI18n: $descriptionI18n,
            sourceI18n: $sourceI18n,
            logo: $entity->getLogo() ?? '',
            sourceType: $sourceType ?? $entity->getSourceType()->value,
            isEnabled: 1,
            pinnedAt: null,
            updatedAt: $entity->getUpdatedAt() ?? '',
            createdAt: $entity->getCreatedAt() ?? '',
            latestPublishedAt: $entity->getPublishedAt(),
            latestVersion: $latestVersion ?? $entity->getVersion(),
            packageName: $entity->getPackageName(),
            creatorInfo: $creatorInfo,
            publisherType: $publisherType,
            publisher: $publisher
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
        array $sourceI18n = [],
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
            sourceI18n: $sourceI18n,
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
        array $latestVersionMap = [],
        array $marketEntityMap = [],
        array $publisherUserMap = []
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
                $latestVersionMap[$entity->getCode()] ?? $entity->getVersion(),
                $publisherType,
                $publisher
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
                packageName: $version->getPackageName(),
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
     * @param array<string, MagicUserEntity> $userMap key 为 userId，同时用于发布者和 MEMBER 类型成员名称展示
     * @param array<string, MagicDepartmentEntity> $memberDepartmentMap key 为 departmentId，用于 MEMBER 类型的部门名称展示
     * @param SkillVersionEntity[] $versions
     */
    public static function createQuerySkillVersionsResponseDTO(
        array $versions,
        array $userMap,
        int $page,
        int $pageSize,
        int $total,
        array $memberDepartmentMap = [],
    ): QuerySkillVersionsResponseDTO {
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
                publishTargetType: $version->getPublishTargetType()->value,
                publisher: OperatorAssembler::createOperatorDTOByUserEntity($userMap[$version->getPublisherUserId() ?? ''] ?? null, $version->getPublishedAt() ?? $version->getCreatedAt()),
                publishedAt: $version->getPublishedAt(),
                isCurrentVersion: $version->isCurrentVersion(),
                versionDescriptionI18n: $version->getVersionDescriptionI18n(),
                publishTargetValue: $enrichedPublishTargetValue,
            );
        }

        return new QuerySkillVersionsResponseDTO($list, $page, $pageSize, $total);
    }

    /**
     * 创建市场技能列表响应 DTO.
     *
     * @param array<string, SkillEntity> $userSkills 用户已添加的技能映射（key 为 skillCode）
     * @param array<string, MagicUserEntity> $publisherUserMap 发布者用户信息映射（key 为 publisherId）
     * @param array<int, SkillVersionEntity> $skillVersionMap key 为 skill_version_id（已解析 file_url）
     * @param int $page 当前页码
     * @param int $pageSize 每页数量
     * @param int $total 总记录数
     * @return SkillMarketListResponseDTO 市场技能列表响应 DTO
     */
    public static function createMarketListResponseDTO(
        array $skillMarketEntities,
        array $userSkills,
        array $publisherUserMap,
        string $currentUserId,
        int $page,
        int $pageSize,
        int $total,
        array $skillVersionMap = []
    ): SkillMarketListResponseDTO {
        $listItems = [];
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

            $version = $skillVersionMap[$skillMarketEntity->getSkillVersionId()] ?? null;
            $isCreator = $version !== null && (string) $version->getCreatorId() === $currentUserId;
            $isAdded = $isCreator ?: $isAdded;
            $fileKey = (string) ($version?->getFileKey() ?? '');
            $fileUrl = $version?->getFileUrl();
            $packageName = (string) ($version?->getPackageName() ?? '');
            $latestVersion = (string) ($version?->getVersion() ?? '');
            $sourceI18n = $version?->getSourceI18n() ?? [];

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
                sourceI18n: $sourceI18n,
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
        $language = CoContext::getLanguage() ?: LanguageEnum::EN_US->value;
        $nameI18n = $skillMarket->getNameI18n() ?? $skillVersion->getNameI18n();
        $descriptionI18n = $skillMarket->getDescriptionI18n() ?? $skillVersion->getDescriptionI18n() ?? [];
        $sourceI18n = $skillVersion->getSourceI18n() ?? [];

        return new SkillMarketDetailResponseDTO(
            code: $skillMarket->getSkillCode(),
            name: self::resolveLocalizedText($nameI18n, $language),
            description: self::resolveLocalizedText($descriptionI18n, $language),
            source: self::resolveLocalizedText($sourceI18n, $language),
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
        );
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

    /**
     * Resolve the current language text with a default-language fallback.
     */
    private static function resolveLocalizedText(?array $i18n, string $language): string
    {
        if ($i18n === null || $i18n === []) {
            return '';
        }

        $localizedValue = $i18n[$language] ?? $i18n[LanguageEnum::DEFAULT->value] ?? null;
        return is_string($localizedValue) ? $localizedValue : '';
    }
}
