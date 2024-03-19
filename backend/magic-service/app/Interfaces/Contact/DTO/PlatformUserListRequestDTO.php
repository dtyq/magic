<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Contact\DTO;

use App\Infrastructure\Core\AbstractDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

class PlatformUserListRequestDTO extends AbstractDTO
{
    public int $page = 1;

    public int $pageSize = 20;

    public ?string $magicId = null;

    public ?string $phone = null;

    public ?string $username = null;

    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $dto->page = (int) $request->input('page', 1);
        $dto->pageSize = (int) $request->input('page_size', 20);

        $magicId = $request->input('magic_id');
        $dto->magicId = is_string($magicId) ? trim($magicId) : null;

        $phone = $request->input('phone');
        $dto->phone = is_string($phone) ? trim($phone) : null;

        $username = $request->input('username');
        $dto->username = is_string($username) ? trim($username) : null;

        return $dto;
    }

    public function toFilters(): array
    {
        return array_filter([
            'magic_id' => $this->magicId,
            'phone' => $this->phone,
            'username' => $this->username,
        ], static fn ($value) => $value !== null && $value !== '');
    }
}
