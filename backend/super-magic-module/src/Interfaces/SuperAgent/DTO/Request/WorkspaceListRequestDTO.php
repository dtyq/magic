<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceArchiveStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceType;
use Hyperf\HttpServer\Contract\RequestInterface;

class WorkspaceListRequestDTO extends AbstractDTO
{
    /**
     * 是否归档 0否 1是.
     */
    public ?int $isArchived = null;

    /**
     * Workspace type filter: default, finance, audio.
     */
    public string $workspaceType = WorkspaceType::Default->value;

    /**
     * 页码
     */
    public int $page = 1;

    /**
     * 每页数量.
     */
    public int $pageSize = 10;

    /**
     * Whether to auto-create workspace when list is empty.
     */
    public bool $autoCreate = true;

    /**
     * 从请求中创建DTO.
     */
    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $dto->isArchived = $request->has('is_archived')
            ? (int) $request->input('is_archived')
            : WorkspaceArchiveStatus::NotArchived->value;
        $dto->workspaceType = $request->input('workspace_type', WorkspaceType::Default->value);
        $dto->page = (int) ($request->input('page', 1) ?: 1);
        $dto->pageSize = (int) ($request->input('page_size', 10) ?: 10);
        $dto->autoCreate = $request->input('auto_create', true) === true
            || $request->input('auto_create', true) === 'true'
            || $request->input('auto_create', true) === 1
            || $request->input('auto_create', true) === '1';

        return $dto;
    }

    /**
     * Get auto-create flag.
     */
    public function getAutoCreate(): bool
    {
        return $this->autoCreate;
    }

    /**
     * 构建查询条件.
     */
    public function buildConditions(): array
    {
        $conditions = [];

        if ($this->isArchived !== null) {
            $conditions['is_archived'] = $this->isArchived;
        } else {
            // 默认归档
            $conditions['is_archived'] = WorkspaceArchiveStatus::NotArchived->value;
        }

        // Add workspace_type filter
        $conditions['workspace_type'] = $this->workspaceType;

        return $conditions;
    }
}
