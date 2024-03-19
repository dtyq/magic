<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\Memory;

use App\Application\Flow\ExecuteManager\Attachment\AttachmentInterface;
use App\Application\Flow\ExecuteManager\Attachment\AttachmentUtil;
use App\Application\Flow\ExecuteManager\Attachment\ExternalAttachment;
use App\Application\Kernel\SmartFileLinks;
use App\Domain\Chat\DTO\Message\TextContentInterface;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Flow\Entity\MagicFlowMemoryHistoryEntity;
use Hyperf\Odin\Contract\Message\MessageInterface;
use Hyperf\Odin\Message\AssistantMessage;
use Hyperf\Odin\Message\Role;
use Hyperf\Odin\Message\UserMessage;
use Hyperf\Odin\Message\UserMessageContent;

class LLMMemoryMessage
{
    /**
     * @var Role 消息角色
     */
    private Role $role;

    /**
     * @var string 消息文本内容
     */
    private string $textContent;

    /**
     * @var string 消息ID
     */
    private string $messageId;

    private string $mountId = '';

    /**
     * @var AttachmentInterface[] 附件列表
     */
    private array $attachments = [];

    /**
     * @var string 原始消息分析结果(多模态分析)
     */
    private string $analysisResult = '';

    /**
     * @var array 原始消息内容
     */
    private array $originalContent = [];

    /**
     * @var string 会话ID
     */
    private string $conversationId = '';

    private string $topicId = '';

    private string $uid = '';

    private string $requestId = '';

    /**
     * @var string 消息类型字符串
     */
    private string $messageTypeString = '';

    public function __construct(Role $role, string $textContent, string $messageId)
    {
        $this->role = $role;
        $this->textContent = $textContent;
        $this->messageId = $messageId;
    }

    public function toOdinMessage(): ?MessageInterface
    {
        if (! $this->isValid()) {
            return null;
        }
        $message = null;
        switch ($this->role) {
            case Role::Assistant:
                $message = new AssistantMessage($this->textContent);
                break;
            case Role::User:
                $images = $this->getImages();
                $message = new UserMessage($this->textContent);
                if (! empty($images)) {
                    $message->addContent(UserMessageContent::text($this->textContent));
                    foreach ($images as $image) {
                        $message->addContent(UserMessageContent::imageUrl($image->getUrl()));
                    }
                }
                break;
            default:
        }
        $message?->setIdentifier($this->getMessageId());
        $message?->setParams([
            'attachments' => $this->attachments,
            'analysis_result' => $this->analysisResult,
        ]);
        return $message;
    }

    /**
     * @return array<AttachmentInterface>
     */
    public function getImages(): array
    {
        $images = [];
        foreach ($this->attachments as $attachment) {
            if ($attachment->isImage()) {
                $images[] = $attachment;
            }
        }
        return $images;
    }

    public static function createByChatMemory(MagicMessageEntity $magicMessageEntity): ?self
    {
        $messageContent = $magicMessageEntity->getContent();
        $textContent = '';
        if ($messageContent instanceof TextContentInterface) {
            $textContent = $messageContent->getTextContent();
        }

        // 获取附件
        $attachments = AttachmentUtil::getByMagicMessageEntity($magicMessageEntity);
        if ($textContent === '' && empty($attachments)) {
            return null;
        }

        // 根据消息类型创建对应的消息
        $messageType = $magicMessageEntity->getSenderType() ?? ConversationType::Ai;
        $role = ($messageType === ConversationType::Ai) ? Role::Assistant : Role::User;

        $customMessage = new LLMMemoryMessage($role, $textContent, $magicMessageEntity->getMagicMessageId());
        $customMessage->setAttachments($attachments);
        $customMessage->setOriginalContent($magicMessageEntity->toArray());
        return $customMessage;
    }

    public static function createByFlowMemory(MagicFlowMemoryHistoryEntity $magicFlowMemoryHistoryEntity): ?self
    {
        $role = Role::tryFrom($magicFlowMemoryHistoryEntity->getRole());
        if (! $role) {
            return null;
        }

        $content = $magicFlowMemoryHistoryEntity->getContent();

        // 获取文本内容
        $textContent = $content['text']['content'] ?? '';

        // 创建自定义消息
        $customMessage = new LLMMemoryMessage($role, $textContent, $magicFlowMemoryHistoryEntity->getMessageId());
        $customMessage->setConversationId($magicFlowMemoryHistoryEntity->getConversationId());
        $customMessage->setOriginalContent($content);

        // 设置消息类型
        $customMessage->setMessageTypeString($content['type'] ?? '');

        // 处理附件
        if (isset($content['flow_attachments']) && is_array($content['flow_attachments'])) {
            $attachments = [];
            foreach ($content['flow_attachments'] as $attachment) {
                $attachmentStruct = null;
                if (isset($attachment['file_key'])) {
                    $url = SmartFileLinks::get($attachment['file_key'])?->getUrl() ?? '';
                    if ($url) {
                        $attachmentStruct = new ExternalAttachment($url);
                    }
                } elseif (isset($attachment['url'])) {
                    $attachmentStruct = new ExternalAttachment($attachment['url']);
                }
                if ($attachmentStruct) {
                    $attachments[] = $attachmentStruct;
                }
            }
            $customMessage->setAttachments($attachments);
        }

        // 验证是否是有效的
        if (! $customMessage->isValid()) {
            return null;
        }

        return $customMessage;
    }

    public function isValid(): bool
    {
        if ($this->textContent === '' && empty($this->attachments)) {
            return false;
        }
        return true;
    }

    public function getTextContent(): string
    {
        return $this->textContent;
    }

    public function setTextContent(string $textContent): self
    {
        $this->textContent = $textContent;
        return $this;
    }

    public function getRole(): Role
    {
        return $this->role;
    }

    public function setRole(Role $role): self
    {
        $this->role = $role;
        return $this;
    }

    public function getMessageId(): string
    {
        return $this->messageId;
    }

    public function setMessageId(string $messageId): self
    {
        $this->messageId = $messageId;
        return $this;
    }

    /**
     * @return AttachmentInterface[]
     */
    public function getAttachments(): array
    {
        return $this->attachments;
    }

    /**
     * @param AttachmentInterface[] $attachments
     */
    public function setAttachments(array $attachments): self
    {
        $this->attachments = $attachments;
        return $this;
    }

    public function addAttachment(AttachmentInterface $attachment): self
    {
        $this->attachments[] = $attachment;
        return $this;
    }

    public function getAnalysisResult(): string
    {
        return $this->analysisResult;
    }

    public function setAnalysisResult(string $analysisResult): self
    {
        $this->analysisResult = $analysisResult;
        return $this;
    }

    public function getOriginalContent(): array
    {
        return $this->originalContent;
    }

    public function setOriginalContent(array $originalContent): self
    {
        $this->originalContent = $originalContent;
        return $this;
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function setConversationId(string $conversationId): self
    {
        $this->conversationId = $conversationId;
        return $this;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function setTopicId(string $topicId): void
    {
        $this->topicId = $topicId;
    }

    public function getUid(): string
    {
        return $this->uid;
    }

    public function setUid(string $uid): void
    {
        $this->uid = $uid;
    }

    public function getRequestId(): string
    {
        return $this->requestId;
    }

    public function setRequestId(string $requestId): void
    {
        $this->requestId = $requestId;
    }

    public function getMountId(): string
    {
        return $this->mountId;
    }

    public function setMountId(string $mountId): void
    {
        $this->mountId = $mountId;
    }

    public function hasAttachments(): bool
    {
        return ! empty($this->attachments);
    }

    public function getMessageTypeString(): string
    {
        return $this->messageTypeString;
    }

    public function setMessageTypeString(string $messageTypeString): self
    {
        $this->messageTypeString = $messageTypeString;
        return $this;
    }
}
