<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

use RuntimeException;

/**
 * Image search request DTO - encapsulates unified image search parameters.
 */
class ImageSearchRequestDTO extends AbstractRequestDTO
{
    /**
     * Search query.
     */
    private string $query = '';

    /**
     * Number of results to return (1-50).
     */
    private int $count = 10;

    /**
     * Pagination offset (0-1000).
     */
    private int $offset = 0;

    /**
     * Preferred provider. Falls back to the enabled default when empty.
     */
    private string $provider = '';

    public function __construct(array $data = [])
    {
        parent::__construct($data);

        // Support both 'q' and 'query' parameters
        $this->query = (string) ($data['q'] ?? $data['query'] ?? '');
        $this->count = (int) ($data['count'] ?? 10);
        $this->offset = (int) ($data['offset'] ?? 0);
        $this->provider = (string) ($data['provider'] ?? '');
    }

    public static function createDTO(array $data): self
    {
        $imageSearchRequestDTO = new self();
        $imageSearchRequestDTO->setQuery((string) ($data['q'] ?? $data['query'] ?? ''));
        $imageSearchRequestDTO->setCount((int) ($data['count'] ?? 10));
        $imageSearchRequestDTO->setOffset((int) ($data['offset'] ?? 0));
        $imageSearchRequestDTO->setProvider((string) ($data['provider'] ?? ''));
        return $imageSearchRequestDTO;
    }

    public function getType(): string
    {
        return 'image_search';
    }

    public function getQuery(): string
    {
        return $this->query;
    }

    public function setQuery(string $query): self
    {
        $this->query = $query;
        return $this;
    }

    public function getCount(): int
    {
        return $this->count;
    }

    public function setCount(int $count): self
    {
        $this->count = $count;
        return $this;
    }

    public function getOffset(): int
    {
        return $this->offset;
    }

    public function setOffset(int $offset): self
    {
        $this->offset = $offset;
        return $this;
    }

    public function getProvider(): string
    {
        return $this->provider;
    }

    public function setProvider(string $provider): self
    {
        $this->provider = trim($provider);
        return $this;
    }

    /**
     * Validate image search parameters.
     *
     * @throws RuntimeException
     */
    public function validate(): void
    {
        if (empty($this->query)) {
            throw new RuntimeException('Search query is required');
        }

        if ($this->count < 1 || $this->count > 50) {
            throw new RuntimeException('Count must be between 1 and 50');
        }

        if ($this->offset < 0 || $this->offset > 1000) {
            throw new RuntimeException('Offset must be between 0 and 1000');
        }
    }
}
