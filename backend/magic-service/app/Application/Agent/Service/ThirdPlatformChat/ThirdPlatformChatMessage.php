<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Service\ThirdPlatformChat;

use App\Application\Flow\ExecuteManager\Attachment\AbstractAttachment;
use App\Application\Flow\ExecuteManager\ExecutionData\TriggerDataUserExtInfo;
use App\ErrorCode\AgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Psr\Http\Message\ResponseInterface;

class ThirdPlatformChatMessage
{
    private ThirdPlatformChatEvent $event = ThirdPlatformChatEvent::None;

    private string $message = '';

    /**
     * @var AbstractAttachment[]
     */
    private array $attachments = [];

    private string $conversationId;

    private string $originConversationId;

    private string $nickname;

    private string $userId;

    private string $robotCode;

    /**
     * 1 单聊 2 群聊.
     */
    private int $type = 0;

    private ?TriggerDataUserExtInfo $userExtInfo = null;

    private ?ResponseInterface $response = null;

    private array $params = [];

    public function validate(): void
    {
        if (empty($this->event)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'event']);
        }
        if ($this->event === ThirdPlatformChatEvent::CheckServer) {
            return;
        }
        if (empty($this->conversationId)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'conversation_id']);
        }
        if (empty($this->originConversationId)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'origin_conversation_id']);
        }
        if (empty($this->nickname)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'nickname']);
        }
        if (empty($this->userId)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'user_id']);
        }
        if (empty($this->robotCode)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'robot_code']);
        }
        if (empty($this->type)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'type']);
        }
    }

    public function isOne(): bool
    {
        return $this->type === 1;
    }

    public function isGroup(): bool
    {
        return $this->type === 2;
    }

    public function getEvent(): ThirdPlatformChatEvent
    {
        return $this->event;
    }

    public function setEvent(ThirdPlatformChatEvent $event): void
    {
        $this->event = $event;
    }

    public function getMessage(): string
    {
        return $this->message;
    }

    public function setMessage(string $message): void
    {
        $this->message = $message;
    }

    public function getAttachments(): array
    {
        return $this->attachments;
    }

    public function setAttachments(array $attachments): void
    {
        $this->attachments = $attachments;
    }

    public function getConversationId(): string
    {
        return $this->conversationId ?? $this->originConversationId;
    }

    public function setConversationId(string $conversationId): void
    {
        $this->conversationId = $conversationId;
    }

    public function getOriginConversationId(): string
    {
        return $this->originConversationId;
    }

    public function setOriginConversationId(string $originConversationId): void
    {
        $this->originConversationId = $originConversationId;
    }

    public function getNickname(): string
    {
        return $this->nickname;
    }

    public function setNickname(string $nickname): void
    {
        $this->nickname = $nickname;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getRobotCode(): string
    {
        return $this->robotCode;
    }

    public function setRobotCode(string $robotCode): void
    {
        $this->robotCode = $robotCode;
    }

    public function getType(): int
    {
        return $this->type;
    }

    public function setType(int $type): void
    {
        $this->type = $type;
    }

    public function getUserExtInfo(): ?TriggerDataUserExtInfo
    {
        return $this->userExtInfo;
    }

    public function setUserExtInfo(?TriggerDataUserExtInfo $userExtInfo): void
    {
        $this->userExtInfo = $userExtInfo;
    }

    public function getResponse(): ?ResponseInterface
    {
        return $this->response;
    }

    public function setResponse(?ResponseInterface $response): void
    {
        $this->response = $response;
    }

    public function getParams(): array
    {
        return $this->params;
    }

    public function setParams(array $params): void
    {
        $this->params = $params;
    }
}
