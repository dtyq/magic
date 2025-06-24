<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class WorkspaceListResponseDTO extends AbstractDTO
{
    /**
     * Total count.
     */
    public int $total = 0;

    /**
     * Whether auto created.
     */
    public bool $autoCreate = false;

    /**
     * Workspace list.
     *
     * @var WorkspaceItemDTO[]
     */
    public array $list = [];

    /**
     * Create DTO from result.
     *
     * @param array $result [total, list, auto_create]
     */
    public static function fromResult(array $result): self
    {
        $dto = new self();
        $dto->total = $result['total'];
        $dto->autoCreate = $result['auto_create'] ?? false;

        foreach ($result['list'] as $workspace) {
            if (is_array($workspace)) {
                $dto->list[] = WorkspaceItemDTO::fromArray($workspace);
            } else {
                $dto->list[] = WorkspaceItemDTO::fromEntity($workspace);
            }
        }

        return $dto;
    }

    /**
     * Convert to array.
     * Output maintains underscore naming for API compatibility.
     */
    public function toArray(): array
    {
        $workspaces = [];
        foreach ($this->list as $workspace) {
            $workspaces[] = $workspace->toArray();
        }

        return [
            'total' => $this->total,
            'auto_create' => $this->autoCreate,
            'list' => $workspaces,
        ];
    }
}
