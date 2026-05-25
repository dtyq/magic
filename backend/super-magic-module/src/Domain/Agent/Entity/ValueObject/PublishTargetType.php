<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

enum PublishTargetType: string
{
    case PRIVATE = 'PRIVATE';
    case MEMBER = 'MEMBER';
    case ORGANIZATION = 'ORGANIZATION';
    case MARKET = 'MARKET';

    public function requiresTargetValue(): bool
    {
        return match ($this) {
            self::MEMBER => true,
            self::PRIVATE, self::ORGANIZATION, self::MARKET => false,
        };
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

    public function getLabel(): string
    {
        return match ($this) {
            self::PRIVATE => 'Private',
            self::MEMBER => 'Specific Members',
            self::ORGANIZATION => 'Organization-wide',
            self::MARKET => 'Crew Market',
        };
    }
}
