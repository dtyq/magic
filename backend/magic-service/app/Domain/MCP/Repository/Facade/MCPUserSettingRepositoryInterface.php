<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Repository\Facade;

use App\Domain\MCP\Entity\MCPUserSettingEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\Query\MCPUserSettingQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface MCPUserSettingRepositoryInterface
{
    public function getById(MCPDataIsolation $dataIsolation, int $id): ?MCPUserSettingEntity;

    /**
     * @param array<int> $ids
     * @return array<int, MCPUserSettingEntity> 返回以id为key的实体对象数组
     */
    public function getByIds(MCPDataIsolation $dataIsolation, array $ids): array;

    /**
     * 根据用户ID和MCP服务ID获取用户设置.
     */
    public function getByUserAndMcpServer(MCPDataIsolation $dataIsolation, string $userId, string $mcpServerId): ?MCPUserSettingEntity;

    /**
     * 根据用户ID获取所有MCP用户设置.
     *
     * @return array<MCPUserSettingEntity>
     */
    public function getByUserId(MCPDataIsolation $dataIsolation, string $userId): array;

    /**
     * 根据MCP服务ID获取所有用户设置.
     *
     * @return array<MCPUserSettingEntity>
     */
    public function getByMcpServerId(MCPDataIsolation $dataIsolation, string $mcpServerId): array;

    /**
     * @return array{total: int, list: array<MCPUserSettingEntity>}
     */
    public function queries(MCPDataIsolation $dataIsolation, MCPUserSettingQuery $query, Page $page): array;

    /**
     * 保存MCP用户设置.
     */
    public function save(MCPDataIsolation $dataIsolation, MCPUserSettingEntity $entity): MCPUserSettingEntity;

    /**
     * 删除MCP用户设置.
     */
    public function delete(MCPDataIsolation $dataIsolation, int $id): bool;

    /**
     * 删除用户的指定MCP服务设置.
     */
    public function deleteByUserAndMcpServer(MCPDataIsolation $dataIsolation, string $userId, string $mcpServerId): bool;

    public function updateAdditionalConfig(MCPDataIsolation $dataIsolation, string $mcpServerId, string $additionalKey, array $additionalValue): void;
}
