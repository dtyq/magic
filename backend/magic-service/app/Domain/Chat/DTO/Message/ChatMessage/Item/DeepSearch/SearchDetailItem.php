<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage\Item\DeepSearch;

use App\Infrastructure\Core\AbstractObject;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

class SearchDetailItem extends AbstractObject
{
    /**
     * @var string 问题 id,一个问题会会有多个搜索结果
     */
    protected string $questionId;

    /**
     * @var string 搜索结果 id
     */
    protected string $id;

    protected string $name;

    protected string $url;

    protected ?string $datePublished;

    protected ?string $datePublishedDisplayText;

    protected bool $isFamilyFriendly;

    protected string $displayUrl;

    protected string $snippet;

    protected ?string $dateLastCrawled;

    protected ?string $cachedPageUrl;

    protected string $language;

    protected bool $isNavigational;

    protected bool $noCache;

    protected ?string $detail;

    public function __construct(array $data)
    {
        parent::__construct($data);
    }

    public function getQuestionId(): string
    {
        return $this->questionId;
    }

    public function setQuestionId(string $questionId): void
    {
        $this->questionId = $questionId;
    }

    public function getId(): string
    {
        return $this->id ?? '';
    }

    public function setId(string $id): void
    {
        // 应前端要求，改为唯一 id
        $this->id = (string) IdGenerator::getSnowId();
    }

    public function getName(): string
    {
        return $this->name ?? '';
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getUrl(): string
    {
        return $this->url ?? '';
    }

    public function setUrl(string $url): void
    {
        $this->url = $url;
    }

    public function getDatePublished(): ?string
    {
        return $this->datePublished ?? '';
    }

    public function setDatePublished(?string $datePublished): void
    {
        $this->datePublished = $datePublished;
    }

    public function getDatePublishedDisplayText(): ?string
    {
        return $this->datePublishedDisplayText ?? '';
    }

    public function setDatePublishedDisplayText(?string $datePublishedDisplayText): void
    {
        $this->datePublishedDisplayText = $datePublishedDisplayText;
    }

    public function isFamilyFriendly(): bool
    {
        return $this->isFamilyFriendly;
    }

    public function setIsFamilyFriendly(bool $isFamilyFriendly): void
    {
        $this->isFamilyFriendly = $isFamilyFriendly;
    }

    public function getDisplayUrl(): string
    {
        return $this->displayUrl ?? '';
    }

    public function setDisplayUrl(string $displayUrl): void
    {
        $this->displayUrl = $displayUrl;
    }

    public function getSnippet(): string
    {
        return $this->snippet ?? '';
    }

    public function setSnippet(string $snippet): void
    {
        $this->snippet = $snippet;
    }

    public function getDateLastCrawled(): ?string
    {
        return $this->dateLastCrawled ?? '';
    }

    public function setDateLastCrawled(?string $dateLastCrawled): void
    {
        $this->dateLastCrawled = $dateLastCrawled;
    }

    public function getCachedPageUrl(): ?string
    {
        return $this->cachedPageUrl ?? '';
    }

    public function setCachedPageUrl(?string $cachedPageUrl): void
    {
        $this->cachedPageUrl = $cachedPageUrl;
    }

    public function getLanguage(): string
    {
        return $this->language ?? '';
    }

    public function setLanguage(string $language): void
    {
        $this->language = $language;
    }

    public function isNavigational(): bool
    {
        return $this->isNavigational ?? false;
    }

    public function setIsNavigational(bool $isNavigational): void
    {
        $this->isNavigational = $isNavigational;
    }

    public function isNoCache(): bool
    {
        return $this->noCache ?? false;
    }

    public function setNoCache(bool $noCache): void
    {
        $this->noCache = $noCache;
    }

    public function getDetail(): ?string
    {
        return $this->detail ?? '';
    }

    public function setDetail(?string $detail): void
    {
        $this->detail = $detail;
    }
}
