<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageScheduleEntity;

class OpenMessageScheduleDetailDTO extends AbstractDTO
{
    public string $id = '';

    public string $taskName = '';

    public string $messageContentText = '';

    public string $topicId = '';

    public string $modelId = '';

    public array $timeConfig = [];

    public int $enabled = 1;

    public int $completed = 0;

    public ?string $updatedAt = null;

    public static function fromEntity(MessageScheduleEntity $entity): self
    {
        $dto = new self();
        $dto->id = (string) $entity->getId();
        $dto->taskName = $entity->getTaskName();
        $dto->topicId = (string) $entity->getTopicId();
        $dto->timeConfig = $entity->getTimeConfig();
        $dto->enabled = $entity->getEnabled();
        $dto->completed = $entity->getCompleted();
        $dto->updatedAt = $entity->getUpdatedAt();

        $messageContent = $entity->getMessageContent();
        $dto->messageContentText = self::extractTextFromMessageContent($messageContent);
        $dto->modelId = self::extractModelIdFromMessageContent($messageContent);

        return $dto;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'task_name' => $this->taskName,
            'message_content_text' => $this->messageContentText,
            'topic_id' => $this->topicId,
            'model_id' => $this->modelId,
            'time_config' => array_intersect_key($this->timeConfig, array_flip(['day', 'time', 'type'])),
            'enabled' => $this->enabled,
            'completed' => $this->completed,
            'updated_at' => $this->updatedAt,
        ];
    }

    /**
     * Extract plain text from message_content.content (JSON doc structure).
     */
    private static function extractTextFromMessageContent(array $messageContent): string
    {
        $contentJson = $messageContent['content'] ?? '';
        if (empty($contentJson)) {
            return '';
        }

        $doc = is_string($contentJson) ? json_decode($contentJson, true) : $contentJson;
        if (! is_array($doc)) {
            return is_string($contentJson) ? $contentJson : '';
        }

        $texts = [];
        self::collectTexts($doc, $texts);
        return implode('', $texts);
    }

    private static function collectTexts(array $node, array &$texts): void
    {
        if (isset($node['type']) && $node['type'] === 'text' && isset($node['text'])) {
            $texts[] = $node['text'];
        }
        if (isset($node['content']) && is_array($node['content'])) {
            foreach ($node['content'] as $child) {
                if (is_array($child)) {
                    self::collectTexts($child, $texts);
                }
            }
        }
    }

    private static function extractModelIdFromMessageContent(array $messageContent): string
    {
        return (string) ($messageContent['extra']['super_agent']['model']['model_id']
            ?? $messageContent['extra']['super_agent']['model']['provider_model_id']
            ?? '');
    }
}
