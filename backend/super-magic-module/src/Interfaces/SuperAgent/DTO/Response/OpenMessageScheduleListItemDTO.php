<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageScheduleEntity;

class OpenMessageScheduleListItemDTO extends AbstractDTO
{
    public string $id = '';

    public string $taskName = '';

    public string $taskDescribe = '';

    public static function fromEntity(MessageScheduleEntity $entity): self
    {
        $dto = new self();
        $dto->id = (string) $entity->getId();
        $dto->taskName = $entity->getTaskName();
        $dto->taskDescribe = self::extractTextFromMessageContent($entity->getMessageContent());
        return $dto;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'task_name' => $this->taskName,
            'task_describe' => $this->taskDescribe,
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
}
