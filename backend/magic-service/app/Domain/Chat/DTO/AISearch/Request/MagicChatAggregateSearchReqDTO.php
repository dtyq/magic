<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\AISearch\Request;

use App\Domain\Chat\DTO\Message\ChatMessage\RichTextMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Chat\DTO\Message\MessageInterface;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\AggregateSearch\SearchDeepLevel;
use App\Domain\Chat\Entity\ValueObject\SearchEngineType;
use App\Infrastructure\Util\Tiptap\TiptapUtil;
use Exception;
use Hyperf\Odin\Memory\MessageHistory;
use Hyperf\Odin\Message\AssistantMessage;
use Hyperf\Odin\Message\UserMessage;

class MagicChatAggregateSearchReqDTO
{
    public string $userMessage;

    public string $conversationId;

    public string $topicId = ''; // 话题 id，可以为空

    public bool $getDetail = true;

    public string $appMessageId;

    public array $magicChatMessageHistory = [];

    public SearchEngineType $searchEngine = SearchEngineType::Bing;

    public string $language = 'zh_CN';

    public ?string $requestId = null;

    public SearchDeepLevel $searchDeepLevel = SearchDeepLevel::SIMPLE;

    public string $userId = '';

    protected string $organizationCode = '';

    private MagicSeqEntity $magicSeqEntity;

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

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function setTopicId(string $topicId): self
    {
        $this->topicId = $topicId;
        return $this;
    }

    public function getConversationId(): string
    {
        return $this->conversationId ?? '';
    }

    public function setConversationId(string $conversationId): self
    {
        $this->conversationId = $conversationId;
        return $this;
    }

    public function getUserMessage(): string
    {
        return $this->userMessage ?? '';
    }

    public function setUserMessage(MessageInterface $userMessage): self
    {
        if ($userMessage instanceof TextMessage) {
            $this->userMessage = $userMessage->getContent();
        } elseif ($userMessage instanceof RichTextMessage) {
            $text = TiptapUtil::getTextContent($userMessage->getContent());
            $this->userMessage = $text;
        } else {
            throw new Exception('不支持的消息类型');
        }

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

    public function isGetDetail(): bool
    {
        return $this->getDetail ?? false;
    }

    public function setGetDetail(bool $getDetail): MagicChatAggregateSearchReqDTO
    {
        $this->getDetail = $getDetail;
        return $this;
    }

    public function getAppMessageId(): string
    {
        return $this->appMessageId ?? '';
    }

    public function setAppMessageId(string $appMessageId): MagicChatAggregateSearchReqDTO
    {
        $this->appMessageId = $appMessageId;
        return $this;
    }

    public function getMagicChatMessageHistory(): array
    {
        return $this->magicChatMessageHistory;
    }

    public function setMagicChatMessageHistory(array $magicChatMessageHistory): MagicChatAggregateSearchReqDTO
    {
        $this->magicChatMessageHistory = $magicChatMessageHistory;
        return $this;
    }

    public function getLanguage(): string
    {
        return $this->language;
    }

    public function setLanguage(string $language): MagicChatAggregateSearchReqDTO
    {
        $this->language = $language;
        return $this;
    }

    public function getRequestId(): ?string
    {
        return $this->requestId;
    }

    public function setRequestId(?string $requestId): MagicChatAggregateSearchReqDTO
    {
        $this->requestId = $requestId;
        return $this;
    }

    public function getSearchDeepLevel(): SearchDeepLevel
    {
        return $this->searchDeepLevel;
    }

    public function setSearchDeepLevel(SearchDeepLevel $searchDeepLevel): MagicChatAggregateSearchReqDTO
    {
        $this->searchDeepLevel = $searchDeepLevel;
        return $this;
    }

    public static function generateLLMHistory(array $rawHistoryMessages, string $llmConversationId): MessageHistory
    {
        $history = new MessageHistory();
        foreach ($rawHistoryMessages as $rawHistoryMessage) {
            $role = $rawHistoryMessage['role'] ?? '';
            $content = $rawHistoryMessage['content'] ?? '';
            if (empty($content)) {
                continue;
            }
            $messageInterface = null;
            switch ($role) {
                case 'user':
                    $messageInterface = new UserMessage($content);
                    break;
                case 'assistant':
                    $messageInterface = new AssistantMessage($content);
                    break;
            }
            isset($messageInterface) && $history->addMessages($messageInterface, $llmConversationId);
        }
        return $history;
    }

    public function getMagicSeqEntity(): MagicSeqEntity
    {
        return $this->magicSeqEntity ?? new MagicSeqEntity();
    }

    public function setMagicSeqEntity(MagicSeqEntity $magicSeqEntity): void
    {
        $this->magicSeqEntity = $magicSeqEntity;
    }
}
