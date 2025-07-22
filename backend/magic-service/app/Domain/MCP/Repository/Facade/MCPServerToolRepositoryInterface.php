<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Repository\Facade;

use App\Domain\MCP\Entity\MCPServerToolEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;

interface MCPServerToolRepositoryInterface
{
    public function getById(MCPDataIsolation $dataIsolation, int $id): ?MCPServerToolEntity;

    /**
     * 根据mcpServerCode查询工具.
     * @return array<MCPServerToolEntity>
     */
    public function getByMcpServerCode(MCPDataIsolation $dataIsolation, string $mcpServerCode): array;

    /**
     * 根据ID和mcpServerCode联合查询工具.
     */
    public function getByIdAndMcpServerCode(MCPDataIsolation $dataIsolation, int $id, string $mcpServerCode): ?MCPServerToolEntity;

    /**
     * @return array<MCPServerToolEntity>
     */
    public function getByMcpServerCodes(MCPDataIsolation $dataIsolation, array $mcpServerCodes): array;

    public function save(MCPDataIsolation $dataIsolation, MCPServerToolEntity $entity): MCPServerToolEntity;

    /**
     * Batch insert multiple new tool entities.
     *
     * @param array<MCPServerToolEntity> $entities
     * @return array<MCPServerToolEntity>
     */
    public function batchInsert(MCPDataIsolation $dataIsolation, array $entities): array;

    public function delete(MCPDataIsolation $dataIsolation, int $id): bool;

    /**
     * Delete all tools for a specific MCP server.
     */
    public function deleteByMcpServerCode(MCPDataIsolation $dataIsolation, string $mcpServerCode): bool;
}
