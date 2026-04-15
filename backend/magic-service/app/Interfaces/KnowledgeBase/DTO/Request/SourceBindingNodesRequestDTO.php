<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

final class SourceBindingNodesRequestDTO extends AbstractRequestDTO
{
    public string $sourceType = '';

    public string $provider = '';

    public string $parentType = '';

    public string $parentRef = '';

    public int $page = 1;

    public int $pageSize = 20;

    public function getSourceType(): string
    {
        return $this->sourceType;
    }

    public function getProvider(): string
    {
        return $this->provider;
    }

    public function getParentType(): string
    {
        return $this->parentType;
    }

    public function getParentRef(): string
    {
        return $this->parentRef;
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public static function fromRequest(RequestInterface $request): static
    {
        $dto = new self();
        $data = $request->all();
        self::checkParams($data);

        $dto->sourceType = (string) ($data['source_type'] ?? '');
        $dto->provider = (string) ($data['provider'] ?? '');
        $dto->parentType = (string) ($data['parent_type'] ?? '');
        $dto->parentRef = (string) ($data['parent_ref'] ?? '');
        $dto->page = max(1, (int) ($data['page'] ?? 1));
        $dto->pageSize = max(1, min(100, (int) ($data['page_size'] ?? 20)));

        return $dto;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'page' => 'integer|min:1',
            'page_size' => 'integer|min:1|max:100',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [];
    }
}
