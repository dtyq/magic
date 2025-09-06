<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * 消息元数据值对象.
 */
class MessageMetadata
{
    private ?UserInfoValueObject $userInfo = null;

    /**
     * 构造函数.
     *
     * @param string $agentUserId 智能体用户ID
     * @param string $userId 用户ID
     * @param string $organizationCode 组织代码
     * @param string $chatConversationId 聊天会话ID
     * @param string $chatTopicId 聊天话题ID
     * @param string $topicId 话题ID
     * @param string $instruction 指令
     * @param string $sandboxId 沙箱ID
     * @param string $superMagicTaskId 超级助手任务ID
     * @param string $workspaceId 工作区ID
     * @param string $projectId 项目ID
     * @param string $language 用户语言
     * @param null|UserInfoValueObject $userInfo 用户信息对象
     */
    public function __construct(
        private string $agentUserId = '',
        private string $userId = '',
        private string $organizationCode = '',
        private string $chatConversationId = '',
        private string $chatTopicId = '',
        private string $topicId = '',
        private string $instruction = '',
        private string $sandboxId = '',
        private string $superMagicTaskId = '',
        private string $workspaceId = '',
        private string $projectId = '',
        private string $language = '',
        ?UserInfoValueObject $userInfo = null
    ) {
        $this->userInfo = $userInfo;
    }

    /**
     * 从数组创建元数据对象.
     *
     * @param array $data 元数据数组
     */
    public static function fromArray(array $data): self
    {
        $userInfo = null;
        if (isset($data['user']) && is_array($data['user'])) {
            $userInfo = UserInfoValueObject::fromArray($data['user']);
        }

        return new self(
            $data['agent_user_id'] ?? '',
            $data['user_id'] ?? '',
            $data['organization_code'] ?? '',
            $data['chat_conversation_id'] ?? '',
            $data['chat_topic_id'] ?? '',
            $data['topic_id'] ?? '',
            $data['instruction'] ?? '',
            $data['sandbox_id'] ?? '',
            $data['super_magic_task_id'] ?? '',
            $data['workspace_id'] ?? '',
            $data['project_id'] ?? '',
            $data['language'] ?? '',
            $userInfo
        );
    }

    /**
     * 转换为数组.
     *
     * @return array 元数据数组
     */
    public function toArray(): array
    {
        $result = [
            'agent_user_id' => $this->agentUserId,
            'user_id' => $this->userId,
            'organization_code' => $this->organizationCode,
            'chat_conversation_id' => $this->chatConversationId,
            'chat_topic_id' => $this->chatTopicId,
            'topic_id' => $this->topicId,
            'instruction' => $this->instruction,
            'sandbox_id' => $this->sandboxId,
            'super_magic_task_id' => $this->superMagicTaskId,
            'workspace_id' => $this->workspaceId,
            'project_id' => $this->projectId,
            'language' => $this->language,
        ];

        // 添加用户信息（如果存在）
        if ($this->userInfo !== null) {
            $result['user'] = $this->userInfo->toArray();
        }

        return $result;
    }

    // Getters
    public function getAgentUserId(): string
    {
        return $this->agentUserId;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getChatConversationId(): string
    {
        return $this->chatConversationId;
    }

    public function getChatTopicId(): string
    {
        return $this->chatTopicId;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function getInstruction(): string
    {
        return $this->instruction;
    }

    public function getSandboxId(): string
    {
        return $this->sandboxId;
    }

    public function getSuperMagicTaskId(): string
    {
        return $this->superMagicTaskId;
    }

    public function getWorkspaceId(): string
    {
        return $this->workspaceId;
    }

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function getLanguage(): string
    {
        return $this->language;
    }

    public function setLanguage(string $language): self
    {
        $this->language = $language;
        return $this;
    }

    /**
     * 获取用户信息.
     *
     * @return null|UserInfoValueObject 用户信息对象
     */
    public function getUserInfo(): ?UserInfoValueObject
    {
        return $this->userInfo;
    }

    // Withers for immutability
    public function withAgentUserId(string $agentUserId): self
    {
        $clone = clone $this;
        $clone->agentUserId = $agentUserId;
        return $clone;
    }

    public function withUserId(string $userId): self
    {
        $clone = clone $this;
        $clone->userId = $userId;
        return $clone;
    }

    public function withOrganizationCode(string $organizationCode): self
    {
        $clone = clone $this;
        $clone->organizationCode = $organizationCode;
        return $clone;
    }

    public function withChatConversationId(string $chatConversationId): self
    {
        $clone = clone $this;
        $clone->chatConversationId = $chatConversationId;
        return $clone;
    }

    public function withChatTopicId(string $chatTopicId): self
    {
        $clone = clone $this;
        $clone->chatTopicId = $chatTopicId;
        return $clone;
    }

    public function withTopicId(string $topicId): self
    {
        $clone = clone $this;
        $clone->topicId = $topicId;
        return $clone;
    }

    public function withInstruction(string $instruction): self
    {
        $clone = clone $this;
        $clone->instruction = $instruction;
        return $clone;
    }

    public function withSandboxId(string $sandboxId): self
    {
        $clone = clone $this;
        $clone->sandboxId = $sandboxId;
        return $clone;
    }

    public function withSuperMagicTaskId(string $superMagicTaskId): self
    {
        $clone = clone $this;
        $clone->superMagicTaskId = $superMagicTaskId;
        return $clone;
    }

    public function withWorkspaceId(string $workspaceId): self
    {
        $clone = clone $this;
        $clone->workspaceId = $workspaceId;
        return $clone;
    }

    public function withProjectId(string $projectId): self
    {
        $clone = clone $this;
        $clone->projectId = $projectId;
        return $clone;
    }

    public function withLanguage(string $language): self
    {
        $clone = clone $this;
        $clone->language = $language;
        return $clone;
    }

    /**
     * 设置用户信息.
     *
     * @param null|UserInfoValueObject $userInfo 用户信息对象
     * @return self 新的实例
     */
    public function withUserInfo(?UserInfoValueObject $userInfo): self
    {
        $clone = clone $this;
        $clone->userInfo = $userInfo;
        return $clone;
    }

    /**
     * 检查是否有用户信息.
     *
     * @return bool 是否有用户信息
     */
    public function hasUserInfo(): bool
    {
        return $this->userInfo !== null;
    }
}
