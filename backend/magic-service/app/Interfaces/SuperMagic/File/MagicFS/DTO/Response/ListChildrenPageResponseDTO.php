<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\MagicFS\DTO\Response;

class ListChildrenPageResponseDTO
{
    /** @var MagicFSFileDTO[] */
    public array $files = [];

    public ?string $next_cursor = null;

    public bool $has_more = false;

    /** Revision of the direct-child listing at the requested parent. */
    public int $listing_revision = 0;

    public bool $not_modified = false;

    public function toArray(): array
    {
        return [
            'files' => array_map(fn ($file) => $file->toArray(), $this->files),
            'next_cursor' => $this->next_cursor,
            'has_more' => $this->has_more,
            'listing_revision' => $this->listing_revision,
            'not_modified' => $this->not_modified,
        ];
    }
}
