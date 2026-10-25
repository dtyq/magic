<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\MagicFS\DTO\Response;

class GetFileTreeChangesResponseDTO
{
    /** @var FileTreeChangeDTO[] */
    public array $changes = [];

    public int $next_revision = 0;

    /** Current revision of the requested root_file_id. */
    public int $revision = 0;

    public bool $has_more = false;

    public bool $cursor_expired = false;

    public function toArray(): array
    {
        return [
            'changes' => array_map(static fn (FileTreeChangeDTO $change): array => $change->toArray(), $this->changes),
            'next_revision' => $this->next_revision,
            'revision' => $this->revision,
            'has_more' => $this->has_more,
            'cursor_expired' => $this->cursor_expired,
        ];
    }
}
