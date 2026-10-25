<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\MagicFS\DTO\Request;

use App\ErrorCode\MagicFSErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * Bounded, keyset-paginated request for one directory's direct children.
 *
 * This is intentionally separate from the legacy list request: callers that
 * do not opt into pagination keep the old response contract, while mounts can
 * never accidentally ask the service to materialise an unbounded directory.
 */
class ListChildrenPageRequestDTO
{
    public string $parent_id = '';

    public ?string $cursor = null;

    public int $limit = 256;

    public ?int $if_revision = null;

    public string $file_name = '';

    public static function fromRequest(RequestInterface $request, string $parentId): self
    {
        $data = $request->all();

        $dto = new self();
        $dto->parent_id = trim($parentId);
        $dto->cursor = isset($data['cursor']) && (string) $data['cursor'] !== ''
            ? trim((string) $data['cursor'])
            : null;
        $dto->limit = (int) ($data['limit'] ?? 256);
        $dto->if_revision = isset($data['if_revision']) && (string) $data['if_revision'] !== ''
            ? (int) $data['if_revision']
            : null;
        $dto->file_name = trim((string) ($data['file_name'] ?? ''));

        if ($dto->parent_id === '' || $dto->parent_id === '0' || ! ctype_digit($dto->parent_id)) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::PARENT_DIRECTORY_NOT_FOUND,
                'magicfs.parent_directory_not_found',
                ['parent_id' => $dto->parent_id]
            );
        }

        // The limit is a resource contract, not a hint.  Keeping the upper
        // bound here prevents a client from turning keyset pagination back
        // into a full-directory response.
        $dto->limit = max(1, min($dto->limit, 1000));

        return $dto;
    }
}
