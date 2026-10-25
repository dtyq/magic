<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Entity\ValueObject;

use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\PrincipalType;

/**
 * 资产可见范围：按主体类型聚合的授权目标。
 *
 * 目前只有两种形态：
 * - {@see self::personal()} 个人素材：本人始终可见，可再追加用户/部门；
 * - {@see self::organization()} 官方公开素材：主体是官方组织码。
 */
final readonly class AssetVisibility
{
    /**
     * @param array<int, array<string>> $principalIdsByType 主体类型值 => 主体 ID 列表（已去空去重）
     * @param bool $includeCurrentUser 是否把当前用户并入用户主体
     */
    private function __construct(
        private array $principalIdsByType,
        private bool $includeCurrentUser,
    ) {
    }

    /**
     * 个人素材可见范围：本人加上额外指定的用户/部门。
     *
     * @param array<string> $userIds
     * @param array<string> $departmentIds
     */
    public static function personal(array $userIds = [], array $departmentIds = []): self
    {
        return new self([
            PrincipalType::USER->value => self::normalize($userIds),
            PrincipalType::DEPARTMENT->value => self::normalize($departmentIds),
        ], true);
    }

    /**
     * 官方公开素材可见范围。
     */
    public static function organization(string $organizationCode): self
    {
        return new self([
            PrincipalType::ORGANIZATION->value => self::normalize([$organizationCode]),
        ], false);
    }

    /**
     * 展开成可见性写入目标：主体类型值 => 主体 ID 列表，空分组直接丢弃。
     *
     * $currentUserId 只并入个人素材：资产对自己始终可见，调用方不必自己拼。
     *
     * @return array<int, array<string>>
     */
    public function principals(string $currentUserId): array
    {
        $principalIdsByType = $this->principalIdsByType;
        if ($this->includeCurrentUser) {
            $userType = PrincipalType::USER->value;
            $principalIdsByType[$userType] = self::normalize([
                $currentUserId,
                ...($principalIdsByType[$userType] ?? []),
            ]);
        }
        return array_filter($principalIdsByType, static fn (array $principalIds): bool => $principalIds !== []);
    }

    /**
     * 去掉空值与重复项，非标量（数组/对象）直接忽略，避免脏数据写进可见性表。
     *
     * @param array<mixed> $principalIds
     * @return array<string>
     */
    private static function normalize(array $principalIds): array
    {
        return array_values(array_unique(array_filter(
            array_map(
                static fn (mixed $principalId): string => is_scalar($principalId) ? (string) $principalId : '',
                $principalIds,
            ),
            static fn (string $principalId): bool => $principalId !== '',
        )));
    }
}
