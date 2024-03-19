<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\Assembler;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Infrastructure\Util\Context\CoContext;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillMarketEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublisherType;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillListItemDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillListResponseDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillMarketListItemDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillMarketListResponseDTO;

class SkillAssembler
{
    /**
     * 创建技能列表项 DTO.
     *
     * @param SkillEntity $entity 技能实体
     * @param bool $needUpgrade 是否需要升级
     * @return SkillListItemDTO 技能列表项 DTO
     */
    public static function createListItemDTO(SkillEntity $entity, bool $needUpgrade = false): SkillListItemDTO
    {
        $language = CoContext::getLanguage();
        $nameI18n = $entity->getNameI18n() ?? [];
        $descriptionI18n = $entity->getDescriptionI18n() ?? [];
        $name = $entity->getI18nName($language);
        $description = $entity->getI18nDescription($language);

        return new SkillListItemDTO(
            id: $entity->getId() ?? 0,
            code: $entity->getCode(),
            name: $name,
            description: $description,
            nameI18n: $nameI18n,
            descriptionI18n: $descriptionI18n,
            logo: $entity->getLogo() ?? '',
            sourceType: $entity->getSourceType()->value,
            isEnabled: $entity->getIsEnabled() ? 1 : 0,
            pinnedAt: $entity->getPinnedAt(),
            needUpgrade: $needUpgrade,
            updatedAt: $entity->getUpdatedAt() ?? '',
            createdAt: $entity->getCreatedAt() ?? ''
        );
    }

    /**
     * 创建市场技能列表项 DTO.
     *
     * @param SkillMarketEntity $entity 市场技能实体
     * @param string $userSkillCode 用户技能编码
     * @param bool $isAdded 是否已添加
     * @param bool $needUpgrade 是否需要升级
     * @param array $publisher 发布者信息
     * @return SkillMarketListItemDTO 市场技能列表项 DTO
     */
    public static function createMarketListItemDTO(
        SkillMarketEntity $entity,
        string $userSkillCode = '',
        bool $isAdded = false,
        bool $needUpgrade = false,
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
            userSkillCode: $userSkillCode,
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
            createdAt: $entity->getCreatedAt() ?? '',
            updatedAt: $entity->getUpdatedAt() ?? ''
        );
    }

    /**
     * 创建技能列表响应 DTO.
     *
     * @param SkillEntity[] $skillEntities 技能实体数组
     * @param array<string, SkillMarketEntity> $storeSkills 商店技能映射（key 为 versionCode，对应 SkillEntity 的 versionCode）
     * @param int $page 当前页码
     * @param int $pageSize 每页数量
     * @param int $total 总记录数
     * @return SkillListResponseDTO 技能列表响应 DTO
     */
    public static function createListResponseDTO(
        array $skillEntities,
        array $storeSkills,
        int $page,
        int $pageSize,
        int $total
    ): SkillListResponseDTO {
        $listItems = [];
        foreach ($skillEntities as $entity) {
            // 判断 need_upgrade（仅针对 source_type='STORE' 的技能）
            $needUpgrade = false;
            if ($entity->getSourceType()->isMarket() && $entity->getVersionCode()) {
                $storeSkill = $storeSkills[$entity->getVersionCode()] ?? null;
                if ($storeSkill) {
                    // 比较用户的 version_id 和商店最新版本的 skill_version_id
                    $needUpgrade = $entity->getVersionId() !== $storeSkill->getSkillVersionId();
                }
            }

            $listItems[] = self::createListItemDTO($entity, $needUpgrade);
        }

        return new SkillListResponseDTO(
            list: $listItems,
            page: $page,
            pageSize: $pageSize,
            total: $total
        );
    }

    /**
     * 创建市场技能列表响应 DTO.
     *
     * @param SkillMarketEntity[] $storeSkillEntities 市场技能实体数组
     * @param array<string, SkillEntity> $userSkills 用户已添加的技能映射（key 为 skillCode）
     * @param array<string, MagicUserEntity> $publisherUserMap 发布者用户信息映射（key 为 publisherId）
     * @param int $page 当前页码
     * @param int $pageSize 每页数量
     * @param int $total 总记录数
     * @return SkillMarketListResponseDTO 市场技能列表响应 DTO
     */
    public static function createMarketListResponseDTO(
        array $storeSkillEntities,
        array $userSkills,
        array $publisherUserMap,
        int $page,
        int $pageSize,
        int $total
    ): SkillMarketListResponseDTO {
        $listItems = [];
        foreach ($storeSkillEntities as $storeSkillEntity) {
            $skillCode = $storeSkillEntity->getSkillCode();
            $userSkill = $userSkills[$skillCode] ?? null;

            // 判断 is_added
            $isAdded = $userSkill !== null;

            // 设置 userSkillCode
            $userSkillCode = $userSkill?->getCode() ?? '';

            // 判断 need_upgrade（仅当 is_added = true 且 source_type = 'STORE' 时有效）
            $needUpgrade = false;
            if ($isAdded && $userSkill && $userSkill->getSourceType()->isMarket()) {
                // 比较用户的 version_id 和商店的 skill_version_id
                $needUpgrade = $userSkill->getVersionId() !== $storeSkillEntity->getSkillVersionId();
            }

            // 构建 publisher 对象
            $publisher = self::buildPublisher(
                $storeSkillEntity->getPublisherType(),
                $storeSkillEntity->getPublisherId(),
                $publisherUserMap[$storeSkillEntity->getPublisherId()] ?? null
            );

            $listItems[] = self::createMarketListItemDTO(
                $storeSkillEntity,
                $userSkillCode,
                $isAdded,
                $needUpgrade,
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
