<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\DTO\Message\LLMMessageInterface;
use App\Domain\Chat\DTO\Message\StreamMessage\StreamMessageTrait;
use App\Domain\Chat\DTO\Message\StreamMessageInterface;
use App\Domain\Chat\DTO\Message\TextContentInterface;
use App\Domain\Chat\DTO\Message\Trait\LLMMessageTrait;
use App\Domain\Chat\Entity\ValueObject\AggregateSearch\AggregateAISearchCardResponseType;
use App\Domain\Chat\Entity\ValueObject\AggregateSearch\SearchDeepLevel;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;

/**
 * 聚合AI搜索的响应卡片消息.
 */
class AggregateAISearchCardMessage extends AbstractChatMessageStruct implements TextContentInterface, StreamMessageInterface, LLMMessageInterface
{
    use StreamMessageTrait;
    use LLMMessageTrait;

    public const int NULL_PARENT_ID = 0;

    protected ?string $parentId = null;

    protected ?string $id = null;

    protected ?int $type = null;

    protected ?string $llmResponse = null;

    protected ?array $associateQuestions = null;

    // 这里要兼容老版本的json数据
    protected null|array|string $mindMap = null;

    protected ?array $searchKeywords = null;

    protected ?array $search = null;

    protected ?array $event = null;

    protected ?string $ppt = null;

    protected ?int $totalWords = null;

    protected ?int $matchCount = null;

    protected ?int $pageCount = null;

    protected ?SearchDeepLevel $searchDeepLevel = null;

    public function __construct(?array $messageStruct = null)
    {
        $mindMap = $messageStruct['mind_map'] ?? null;
        $searchDeepLevel = $messageStruct['search_deep_level'] ?? null;
        unset($messageStruct['mind_map'], $messageStruct['search_deep_level']);
        $this->setMindMap($mindMap)->setSearchDeepLevel($searchDeepLevel);
        parent::__construct($messageStruct);
    }

    public function getParentId(): ?string
    {
        return $this->parentId;
    }

    public function setParentId(?string $parentId): self
    {
        $this->parentId = $parentId;
        return $this;
    }

    public function getId(): ?string
    {
        return $this->id;
    }

    public function setId(string $id): self
    {
        $this->id = $id;
        return $this;
    }

    public function getType(): ?int
    {
        return $this->type;
    }

    public function setType(?int $type): self
    {
        $this->type = $type;
        return $this;
    }

    public function getLlmResponse(): ?string
    {
        return $this->llmResponse;
    }

    public function setLlmResponse(?string $llmResponse): self
    {
        $this->llmResponse = $llmResponse;
        // 外部实现还是读的 content，这里也同步给 content 赋值
        isset($llmResponse) && $this->content = $llmResponse;
        return $this;
    }

    public function getAssociateQuestions(): ?array
    {
        return $this->associateQuestions;
    }

    public function setAssociateQuestions(?array $associateQuestions): self
    {
        $this->associateQuestions = $associateQuestions;
        return $this;
    }

    public function getSearchKeywords(): ?array
    {
        return $this->searchKeywords;
    }

    public function setSearchKeywords(?array $searchKeywords): self
    {
        $this->searchKeywords = $searchKeywords;
        return $this;
    }

    public function getSearch(): ?array
    {
        return $this->search;
    }

    public function setSearch(?array $search): self
    {
        $this->search = $search;
        return $this;
    }

    public function getEvent(): ?array
    {
        return $this->event;
    }

    public function setEvent(?array $event): self
    {
        $this->event = $event;
        return $this;
    }

    public function getPpt(): ?string
    {
        return $this->ppt;
    }

    public function setPpt(?string $ppt): self
    {
        $this->ppt = $ppt;
        return $this;
    }

    public function getTotalWords(): ?int
    {
        return $this->totalWords;
    }

    public function setTotalWords(?int $totalWords): self
    {
        $this->totalWords = $totalWords;
        return $this;
    }

    public function getMatchCount(): ?int
    {
        return $this->matchCount;
    }

    public function setMatchCount(?int $matchCount): self
    {
        $this->matchCount = $matchCount;
        return $this;
    }

    public function getPageCount(): ?int
    {
        return $this->pageCount;
    }

    public function setPageCount(?int $pageCount): self
    {
        $this->pageCount = $pageCount;
        return $this;
    }

    public function getMindMap(): null|array|string
    {
        return $this->mindMap;
    }

    public function setMindMap(null|array|string $mindMap): AggregateAISearchCardMessage
    {
        $this->mindMap = $mindMap;
        return $this;
    }

    public function getSearchDeepLevel(): ?SearchDeepLevel
    {
        return $this->searchDeepLevel;
    }

    public function setSearchDeepLevel(null|int|SearchDeepLevel $searchDeepLevel): AggregateAISearchCardMessage
    {
        if (is_int($searchDeepLevel)) {
            $this->searchDeepLevel = SearchDeepLevel::from($searchDeepLevel);
        } else {
            $this->searchDeepLevel = $searchDeepLevel;
        }
        return $this;
    }

    /**
     * 只返回大模型返回的文本内容， 且忽略无效的内容，如: "已经为您找到答案，请等待生成总结“.
     */
    public function getTextContent(): string
    {
        if ($this->type === AggregateAISearchCardResponseType::LLM_RESPONSE && (int) $this->parentId === self::NULL_PARENT_ID) {
            return $this->llmResponse ?? '';
        }
        return '';
    }

    public function getContent(): string
    {
        return $this->getLlmResponse() ?? '';
    }

    public function setContent(string $content): static
    {
        $this->setLlmResponse($content);
        // 外部实现还是读的 content，这里也同步给 content 赋值
        $this->content = $content;
        return $this;
    }

    protected function setMessageType(): void
    {
        $this->chatMessageType = ChatMessageType::AggregateAISearchCard;
    }
}
