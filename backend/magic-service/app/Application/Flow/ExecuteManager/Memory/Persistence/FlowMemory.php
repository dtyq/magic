<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\Memory\Persistence;

use App\Application\Flow\ExecuteManager\Attachment\AttachmentInterface;
use App\Application\Flow\ExecuteManager\Memory\LLMMemoryMessage;
use App\Application\Flow\ExecuteManager\Memory\MemoryQuery;
use App\Domain\Flow\Entity\MagicFlowMemoryHistoryEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\MemoryType;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowMemoryHistoryQuery;
use App\Domain\Flow\Service\MagicFlowMemoryHistoryDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use DateTime;

class FlowMemory implements MemoryPersistenceInterface
{
    public function __construct(
        protected MagicFlowMemoryHistoryDomainService $magicFlowMemoryHistoryDomainService,
    ) {
    }

    public function queries(MemoryQuery $memoryQuery, array $ignoreMessageIds = []): array
    {
        $query = new MagicFlowMemoryHistoryQuery();
        $query->setConversationId($memoryQuery->getConversationId());
        $query->setTopicId($memoryQuery->getTopicId());
        $query->setType(MemoryType::Chat->value);
        $query->setOrder(['id' => 'desc']);
        if ($memoryQuery->getStartTime()) {
            $query->setStartTime($memoryQuery->getStartTime());
        }

        $page = new Page(1, $memoryQuery->getLimit());
        $flowDataIsolation = FlowDataIsolation::create()->disabled();

        $historyResult = $this->magicFlowMemoryHistoryDomainService->queries($flowDataIsolation, $query, $page);
        /** @var MagicFlowMemoryHistoryEntity[] $histories */
        $histories = array_reverse($historyResult['list'], true);

        $messages = [];
        foreach ($histories as $history) {
            if (in_array($history->getMessageId(), $ignoreMessageIds)) {
                continue;
            }
            $customMessage = LLMMemoryMessage::createByFlowMemory($history);
            if (! $customMessage) {
                continue;
            }
            $messages[] = $customMessage;
        }

        return $messages;
    }

    public function store(LLMMemoryMessage $LLMMemoryMessage): void
    {
        $history = new MagicFlowMemoryHistoryEntity();
        $history->setType(MemoryType::Chat);
        $history->setConversationId($LLMMemoryMessage->getConversationId());
        $history->setTopicId($LLMMemoryMessage->getTopicId());
        $history->setRequestId($LLMMemoryMessage->getRequestId());
        $history->setMessageId($LLMMemoryMessage->getMessageId());
        $history->setRole($LLMMemoryMessage->getRole()->value);
        $content = $LLMMemoryMessage->getOriginalContent();
        if (empty($content['flow_attachments'])) {
            $content['flow_attachments'] = array_map(fn (AttachmentInterface $attachment) => $attachment->toArray(), $LLMMemoryMessage->getAttachments());
        }
        $history->setContent($content);
        $history->setCreatedUid($LLMMemoryMessage->getUid());
        $history->setCreatedAt(new DateTime());
        $flowDataIsolation = FlowDataIsolation::create(userId: $LLMMemoryMessage->getUid());
        $this->magicFlowMemoryHistoryDomainService->create($flowDataIsolation, $history);
    }
}
