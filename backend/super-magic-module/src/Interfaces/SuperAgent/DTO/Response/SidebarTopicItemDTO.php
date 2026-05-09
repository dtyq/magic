<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class SidebarTopicItemDTO extends AbstractDTO
{
    protected string $id = '';

    protected string $topicName = '';

    protected string $projectId = '';

    protected string $workspaceId = '';

    protected string $status = 'waiting';

    protected string $topicMode = '';

    protected string $updatedAt = '';

    protected bool $isPinned = false;

    protected ?string $pinnedAt = null;

    protected bool $isArchived = false;

    protected ?string $lastReadAt = null;

    protected ?string $lastReadMessageId = null;

    protected bool $hasUnread = false;

    public static function fromArray(array $data): self
    {
        $dto = new self();
        foreach ($data as $key => $value) {
            $property = lcfirst(str_replace(' ', '', ucwords(str_replace('_', ' ', $key))));
            if (property_exists($dto, $property)) {
                $dto->{$property} = $value;
            }
        }
        return $dto;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'topic_name' => $this->topicName,
            'project_id' => $this->projectId,
            'workspace_id' => $this->workspaceId,
            'status' => $this->status,
            'topic_mode' => $this->topicMode,
            'updated_at' => $this->updatedAt,
            'is_pinned' => $this->isPinned,
            'pinned_at' => $this->pinnedAt,
            'is_archived' => $this->isArchived,
            'last_read_at' => $this->lastReadAt,
            'last_read_message_id' => $this->lastReadMessageId,
            'has_unread' => $this->hasUnread,
        ];
    }
}
