<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject;

/**
 * Skill publish target type.
 */
enum PublishTargetType: string
{
    /**
     * Publish privately for personal use.
     */
    case PRIVATE = 'PRIVATE';

    /**
     * Publish to specific members or departments.
     */
    case MEMBER = 'MEMBER';

    /**
     * Publish organization-wide.
     */
    case ORGANIZATION = 'ORGANIZATION';

    /**
     * Publish to the skill market.
     */
    case MARKET = 'MARKET';

    public function requiresTargetValue(): bool
    {
        return $this === self::MEMBER;
    }

    /**
     * 是否属于组织后台审核范围。
     */
    public function requiresOrganizationReview(): bool
    {
        return in_array($this, [self::ORGANIZATION, self::MEMBER], true);
    }

    /**
     * 组织后台审核列表默认允许的发布目标类型。
     *
     * @return string[]
     */
    public static function organizationReviewValues(): array
    {
        return [
            self::ORGANIZATION->value,
            self::MEMBER->value,
        ];
    }

    /**
     * 管理后台单值筛选转换为仓储层数组条件；null 表示不筛选发布目标。
     *
     * @return null|string[]
     */
    public static function filterValues(?string $publishTargetType): ?array
    {
        if ($publishTargetType === null || $publishTargetType === '') {
            return null;
        }

        return [$publishTargetType];
    }

    /**
     * 组织后台审核列表的发布目标筛选值。
     * 空值表示查询全部组织审核目标，非法值返回空数组让上层直接返回空列表。
     *
     * @return string[]
     */
    public static function resolveOrganizationReviewFilterValues(?string $publishTargetType): array
    {
        if ($publishTargetType === null || $publishTargetType === '') {
            return self::organizationReviewValues();
        }

        return in_array($publishTargetType, self::organizationReviewValues(), true)
            ? [$publishTargetType]
            : [];
    }

    public function isMarket(): bool
    {
        return $this === self::MARKET;
    }
}
