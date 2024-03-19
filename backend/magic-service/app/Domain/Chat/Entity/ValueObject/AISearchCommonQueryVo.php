<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject;

use App\Domain\Chat\DTO\Message\ChatMessage\Item\DeepSearch\SearchDetailItem;
use Hyperf\Odin\Contract\Model\ModelInterface;
use Hyperf\Odin\Memory\MessageHistory;

class AISearchCommonQueryVo
{
    public ?string $userMessage = null;

    public ?array $llmResponses = null;

    /**
     * @var SearchDetailItem[]
     */
    public ?array $searchContexts = null;

    public bool $filterSearchContexts = true;

    public ?MessageHistory $messageHistory = null;

    public ?string $conversationId = null;

    public ?ModelInterface $model = null;

    public SearchEngineType $searchEngine = SearchEngineType::Bing;

    public bool $generateSearchKeywords = true;

    public string $language;

    /**
     * @var string[]
     */
    protected array $searchKeywords = [];

    protected string $userId;

    protected string $organizationCode;

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    public function getSearchKeywords(): array
    {
        return $this->searchKeywords;
    }

    public function setSearchKeywords(array $searchKeywords): self
    {
        $this->searchKeywords = $searchKeywords;
        return $this;
    }

    public function getUserMessage(): ?string
    {
        return $this->userMessage;
    }

    public function setUserMessage(?string $userMessage): self
    {
        $this->userMessage = $userMessage;
        return $this;
    }

    public function getSearchContexts(): array
    {
        return $this->searchContexts ?? [];
    }

    public function setSearchContexts(?array $searchContexts): self
    {
        foreach ($searchContexts as $key => $searchContext) {
            if ($searchContext instanceof SearchDetailItem) {
                continue;
            }
            $searchContexts[$key] = new SearchDetailItem($searchContext);
        }
        $this->searchContexts = $searchContexts;
        return $this;
    }

    public function isFilterSearchContexts(): ?bool
    {
        return $this->filterSearchContexts;
    }

    public function setFilterSearchContexts(?bool $filterSearchContexts): self
    {
        $this->filterSearchContexts = $filterSearchContexts;
        return $this;
    }

    public function getMessageHistory(): ?MessageHistory
    {
        return $this->messageHistory;
    }

    public function setMessageHistory(?MessageHistory $messageHistory): self
    {
        $this->messageHistory = $messageHistory;
        return $this;
    }

    public function getConversationId(): ?string
    {
        return $this->conversationId;
    }

    public function setConversationId(?string $conversationId): self
    {
        $this->conversationId = $conversationId;
        return $this;
    }

    public function getModel(): ModelInterface
    {
        return $this->model;
    }

    public function setModel(?ModelInterface $model): self
    {
        $this->model = $model;
        return $this;
    }

    public function getLlmResponses(): ?array
    {
        return $this->llmResponses;
    }

    public function setLlmResponses(?array $llmResponses): self
    {
        $this->llmResponses = $llmResponses;
        return $this;
    }

    public function appendLlmResponse(string $llmResponse): self
    {
        $this->llmResponses[] = $llmResponse;
        return $this;
    }

    public function getSearchEngine(): SearchEngineType
    {
        return $this->searchEngine;
    }

    public function setSearchEngine(SearchEngineType $searchEngine): self
    {
        $this->searchEngine = $searchEngine;
        return $this;
    }

    public function isGenerateSearchKeywords(): bool
    {
        return $this->generateSearchKeywords;
    }

    public function setGenerateSearchKeywords(bool $generateSearchKeywords): self
    {
        $this->generateSearchKeywords = $generateSearchKeywords;
        return $this;
    }

    public function getLanguage(): string
    {
        return $this->language;
    }

    public function setLanguage(string $language): AISearchCommonQueryVo
    {
        $this->language = $language;
        return $this;
    }

    // magic api 二期参数
    public function getMagicApiBusinessParam(): array
    {
        return [
            'organization_id' => $this->getOrganizationCode(),
            'user_id' => $this->getUserId(),
            'business_id' => uniqid('odin_', true),
            'source_id' => 'ai_search',
            'user_name' => '',
        ];
    }
}
