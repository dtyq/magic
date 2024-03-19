<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use JsonSerializable;

/**
 * STS Token 刷新请求 DTO.
 */
class RefreshStsTokenRequestDTO implements JsonSerializable
{
    /**
     * 代理用户ID.
     */
    private string $agentUserId = '';

    /**
     * 用户ID.
     */
    private string $userId = '';

    /**
     * 组织编码
     */
    private string $organizationCode = '';

    /**
     * 聊天会话ID.
     */
    private string $chatConversationId = '';

    /**
     * 聊天话题ID.
     */
    private string $chatTopicId = '';

    /**
     * 指令类型.
     */
    private string $instruction = '';

    /**
     * 沙箱ID.
     */
    private string $sandboxId = '';

    /**
     * 超级Magic任务ID.
     */
    private string $superMagicTaskId = '';

    /**
     * Project ID.
     */
    private string $projectId = '';

    /**
     * 从请求数据创建DTO.
     */
    public static function fromRequest(array $data, MagicUserAuthorization $magicUserAuthorization): self
    {
        $instance = new self();

        if (isset($data['metadata'])) {
            $metadata = $data['metadata'];

            $instance->agentUserId = $metadata['agent_user_id'] ?? '';
            $instance->userId = $magicUserAuthorization->getId();
            $instance->organizationCode = $magicUserAuthorization->getOrganizationCode();
            $instance->chatConversationId = $metadata['chat_conversation_id'] ?? '';
            $instance->chatTopicId = $metadata['chat_topic_id'] ?? '';
            $instance->instruction = $metadata['instruction'] ?? '';
            $instance->sandboxId = $metadata['sandbox_id'] ?? '';
            $instance->superMagicTaskId = $metadata['super_magic_task_id'] ?? '';
            $instance->projectId = $metadata['project_id'] ?? '';
        }

        return $instance;
    }

    public function getAgentUserId(): string
    {
        return $this->agentUserId;
    }

    public function setAgentUserId(string $agentUserId): self
    {
        $this->agentUserId = $agentUserId;
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

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function getChatConversationId(): string
    {
        return $this->chatConversationId;
    }

    public function setChatConversationId(string $chatConversationId): self
    {
        $this->chatConversationId = $chatConversationId;
        return $this;
    }

    public function getChatTopicId(): string
    {
        return $this->chatTopicId;
    }

    public function setChatTopicId(string $chatTopicId): self
    {
        $this->chatTopicId = $chatTopicId;
        return $this;
    }

    public function getInstruction(): string
    {
        return $this->instruction;
    }

    public function setInstruction(string $instruction): self
    {
        $this->instruction = $instruction;
        return $this;
    }

    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    public function setSandboxId(string $sandboxId): self
    {
        $this->sandboxId = $sandboxId;
        return $this;
    }

    public function getSuperMagicTaskId(): string
    {
        return $this->superMagicTaskId;
    }

    public function setSuperMagicTaskId(string $superMagicTaskId): self
    {
        $this->superMagicTaskId = $superMagicTaskId;
        return $this;
    }

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function setProjectId(string $projectId): self
    {
        $this->projectId = $projectId;
        return $this;
    }

    /**
     * 实现JsonSerializable接口.
     */
    public function jsonSerialize(): array
    {
        return [
            'agent_user_id' => $this->agentUserId,
            'user_id' => $this->userId,
            'organization_code' => $this->organizationCode,
            'chat_conversation_id' => $this->chatConversationId,
            'chat_topic_id' => $this->chatTopicId,
            'instruction' => $this->instruction,
            'sandbox_id' => $this->sandboxId,
            'super_magic_task_id' => $this->superMagicTaskId,
            'project_id' => $this->projectId,
        ];
    }
}
