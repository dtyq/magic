<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

use RuntimeException;

/**
 * Search request DTO - encapsulates unified search parameters.
 */
class SearchRequestDTO extends AbstractRequestDTO
{
    /**
     * Search query.
     */
    private string $query = '';

    /**
     * Search engine name (bing, google, tavily, duckduckgo, jina).
     * Null means use default from config.
     */
    private ?string $engine = null;

    /**
     * Number of results to return (1-50).
     */
    private int $count = 10;

    /**
     * Pagination offset (0-1000).
     */
    private int $offset = 0;

    /**
     * Market code (e.g., zh-CN, en-US).
     */
    private string $mkt = 'zh-CN';

    /**
     * UI language code.
     */
    private string $setLang = '';

    /**
     * Safe search level (Strict, Moderate, Off).
     */
    private string $safeSearch = '';

    /**
     * Time filter (Day, Week, Month).
     */
    private string $freshness = '';

    public function __construct(array $data = [])
    {
        parent::__construct($data);

        // Support both 'q' and 'query' parameters
        $this->query = (string) ($data['q'] ?? $data['query'] ?? '');
        $this->engine = ! empty($data['engine']) ? (string) $data['engine'] : null;
        $this->count = (int) ($data['count'] ?? 10);
        $this->offset = (int) ($data['offset'] ?? 0);
        $this->mkt = (string) ($data['mkt'] ?? 'zh-CN');

        // Support both 'setLang' and 'set_lang'
        $this->setLang = (string) ($data['setLang'] ?? $data['set_lang'] ?? '');

        // Support both 'safeSearch' and 'safe_search'
        $this->safeSearch = (string) ($data['safeSearch'] ?? $data['safe_search'] ?? '');

        $this->freshness = (string) ($data['freshness'] ?? '');
    }

    public static function createDTO(array $data): self
    {
        $searchRequestDTO = new self();
        $searchRequestDTO->setQuery((string) ($data['q'] ?? $data['query'] ?? ''));
        $searchRequestDTO->setEngine($data['engine'] ?? null);
        $searchRequestDTO->setCount((int) ($data['count'] ?? 10));
        $searchRequestDTO->setOffset((int) ($data['offset'] ?? 0));
        $searchRequestDTO->setMkt((string) ($data['mkt'] ?? 'zh-CN'));
        $searchRequestDTO->setSetLang((string) ($data['setLang'] ?? $data['set_lang'] ?? ''));
        $searchRequestDTO->setSafeSearch((string) ($data['safeSearch'] ?? $data['safe_search'] ?? ''));
        $searchRequestDTO->setFreshness((string) ($data['freshness'] ?? ''));
        return $searchRequestDTO;
    }

    public function getType(): string
    {
        return 'search';
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

    public function getEngine(): ?string
    {
        return $this->engine;
    }

    public function setEngine(?string $engine): self
    {
        $this->engine = $engine;
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

    public function getMkt(): string
    {
        return $this->mkt;
    }

    public function setMkt(string $mkt): self
    {
        $this->mkt = $mkt;
        return $this;
    }

    public function getSetLang(): string
    {
        return $this->setLang;
    }

    public function setSetLang(string $setLang): self
    {
        $this->setLang = $setLang;
        return $this;
    }

    public function getSafeSearch(): string
    {
        return $this->safeSearch;
    }

    public function setSafeSearch(string $safeSearch): self
    {
        $this->safeSearch = $safeSearch;
        return $this;
    }

    public function getFreshness(): string
    {
        return $this->freshness;
    }

    public function setFreshness(string $freshness): self
    {
        $this->freshness = $freshness;
        return $this;
    }

    /**
     * Validate search parameters.
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
