<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Repository\Facade;

use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\Query\MCPServerQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface MCPServerRepositoryInterface
{
    public function getById(MCPDataIsolation $dataIsolation, int $id): ?MCPServerEntity;

    /**
     * @param array<int> $ids
     * @return array<int, MCPServerEntity> 返回以id为key的实体对象数组
     */
    public function getByIds(MCPDataIsolation $dataIsolation, array $ids): array;

    public function getByCode(MCPDataIsolation $dataIsolation, string $code): ?MCPServerEntity;

    public function getOrgCodes(MCPDataIsolation $dataIsolation): array;

    /**
     * @return array{total: int, list: array<MCPServerEntity>}
     */
    public function queries(MCPDataIsolation $dataIsolation, MCPServerQuery $query, Page $page): array;

    /**
     * 保存MCP服务
     */
    public function save(MCPDataIsolation $dataIsolation, MCPServerEntity $entity): MCPServerEntity;

    /**
     * 删除MCP服务
     */
    public function delete(MCPDataIsolation $dataIsolation, string $code): bool;
}
