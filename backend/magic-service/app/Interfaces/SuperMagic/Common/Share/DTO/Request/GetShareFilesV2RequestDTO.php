<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Common\Share\DTO\Request;

use Hyperf\HttpServer\Contract\RequestInterface;
use InvalidArgumentException;

class GetShareFilesV2RequestDTO
{
    public const DEFAULT_PAGE_SIZE = 100;

    public const MAX_PAGE_SIZE = 1000;

    public const MAX_CURSOR_STATES = 10000;

    public const MAX_CURSOR_BYTES = 1024 * 1024;

    public int $pageSize;

    public array $nextParentIds;

    public ?string $scopeVersion;

    public string $password;

    public function __construct(array $data = [])
    {
        $size = (int) ($data['page_size'] ?? self::DEFAULT_PAGE_SIZE);
        $this->pageSize = max(1, min($size ?: self::DEFAULT_PAGE_SIZE, self::MAX_PAGE_SIZE));
        $this->password = (string) ($data['pwd'] ?? $data['password'] ?? '');
        $scopeVersion = $data['scope_version'] ?? null;
        $this->scopeVersion = $scopeVersion === null ? null : trim((string) $scopeVersion);
        $value = $data['next_parent_ids'] ?? [];
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            if (! is_array($decoded)) {
                throw new InvalidArgumentException('next_parent_ids must be a JSON array');
            }
            $value = $decoded;
        }
        if (! is_array($value)) {
            throw new InvalidArgumentException('next_parent_ids must be an array');
        }

        $this->nextParentIds = [];
        foreach ($value as $item) {
            if (! is_array($item)) {
                throw new InvalidArgumentException('next_parent_ids items must be arrays');
            }

            $kind = (string) ($item['kind'] ?? 'children');
            if ($kind === 'entry') {
                $afterId = trim((string) ($item['after_id'] ?? ''));
                if ($afterId === '' || (int) $afterId <= 0) {
                    throw new InvalidArgumentException('entry cursor requires a positive after_id');
                }
                $this->nextParentIds[] = [
                    'kind' => 'entry',
                    'after_id' => $afterId,
                ];
                continue;
            }

            if ($kind !== 'children') {
                throw new InvalidArgumentException('unsupported cursor kind');
            }

            $parentId = trim((string) ($item['parent_id'] ?? ''));
            if ($parentId === '' || (int) $parentId <= 0) {
                throw new InvalidArgumentException('children cursor requires a positive parent_id');
            }

            $afterSort = $item['after_sort'] ?? null;
            $afterFileId = $item['after_file_id'] ?? null;
            if (($afterSort === null) !== ($afterFileId === null)) {
                throw new InvalidArgumentException('children cursor position must be complete');
            }

            $this->nextParentIds[] = [
                'kind' => 'children',
                'parent_id' => $parentId,
                'after_sort' => $afterSort === null ? null : (int) $afterSort,
                'after_file_id' => $afterFileId === null ? null : (string) $afterFileId,
            ];
        }
        if (count($this->nextParentIds) > self::MAX_CURSOR_STATES
            || strlen((string) json_encode($this->nextParentIds)) > self::MAX_CURSOR_BYTES) {
            throw new InvalidArgumentException('next_parent_ids is too large');
        }
    }

    public static function fromRequest(RequestInterface $request): self
    {
        return new self($request->all());
    }
}
