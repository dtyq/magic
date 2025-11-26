<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * Individual search result item.
 */
class SearchResultItemDTO extends AbstractDTO
{
    protected string $id = '';

    protected string $name = '';

    protected string $url = '';

    protected string $snippet = '';

    protected string $displayUrl = '';

    protected string $dateLastCrawled = '';

    protected ?float $score = null;

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): void
    {
        $this->id = $id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getUrl(): string
    {
        return $this->url;
    }

    public function setUrl(string $url): void
    {
        $this->url = $url;
    }

    public function getSnippet(): string
    {
        return $this->snippet;
    }

    public function setSnippet(string $snippet): void
    {
        $this->snippet = $snippet;
    }

    public function getDisplayUrl(): string
    {
        return $this->displayUrl;
    }

    public function setDisplayUrl(string $displayUrl): void
    {
        $this->displayUrl = $displayUrl;
    }

    public function getDateLastCrawled(): string
    {
        return $this->dateLastCrawled;
    }

    public function setDateLastCrawled(string $dateLastCrawled): void
    {
        $this->dateLastCrawled = $dateLastCrawled;
    }

    public function getScore(): ?float
    {
        return $this->score;
    }

    public function setScore(?float $score): void
    {
        $this->score = $score;
    }
}
