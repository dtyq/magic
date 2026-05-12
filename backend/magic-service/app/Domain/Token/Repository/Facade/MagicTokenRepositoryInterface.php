<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Token\Repository\Facade;

use App\Domain\Token\Entity\MagicTokenEntity;
use App\Domain\Token\Entity\ValueObject\MagicTokenType;

interface MagicTokenRepositoryInterface
{
    /**
     * 获取 token 关联值.比如 token对应的 magic_id是多少.
     *
     * @deprecated 请使用 queryTokenEntity 代替
     */
    public function getTokenEntity(MagicTokenEntity $tokenDTO): ?MagicTokenEntity;

    /**
     * 通过 token 查询（不指定类型），用于确定 token 的类型.
     */
    public function getTokenEntityByToken(string $token): ?MagicTokenEntity;

    /**
     * 查询 token 关联值.
     */
    public function queryTokenEntity(MagicTokenType $type, string $token, bool $checkExpired = true): ?MagicTokenEntity;

    public function createToken(MagicTokenEntity $tokenDTO): void;

    public function getTokenByTypeAndRelationValue(MagicTokenType $type, string $relationValue): ?MagicTokenEntity;

    /**
     * 按 type + relationValue 列出 token（通常用于同一个业务维度下的 token 收敛/清理）。
     *
     * @param MagicTokenType $type Token 类型
     * @param string $relationValue 关联值（如 user_id、resource_id 等）
     * @param bool $checkExpired 是否检查过期：true=只返回未过期的（有效）; false=返回所有（包含过期）
     * @param int $limit 返回条数限制
     * @return MagicTokenEntity[]
     */
    public function listTokenEntitiesByTypeAndRelationValue(
        MagicTokenType $type,
        string $relationValue,
        bool $checkExpired = true,
        int $limit = 50
    ): array;

    /**
     * 刷新指定 token 的过期时间.
     */
    public function refreshTokenExpiration(MagicTokenEntity $tokenDTO): void;

    /**
     * 批量更新 token 过期时间。
     *
     * @param int[] $ids
     */
    public function batchUpdateTokenExpiration(array $ids, string $expiredAt): int;

    public function deleteToken(MagicTokenEntity $tokenDTO): void;

    /**
     * 批量删除已过期的 token。
     *
     * @return int 实际删除的行数
     */
    public function deleteExpiredTokens(int $batchSize): int;
}
