<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;

class TopicItemDTO extends AbstractDTO
{
    /**
     * @var string 话题ID
     */
    protected string $id = '';

    /**
     * @var string 聊天话题ID
     */
    protected string $chatTopicId = '';

    /**
     * @var string 话题名称
     */
    protected string $topicName = '';

    /**
     * @var string 任务状态
     */
    protected string $taskStatus = '';

    /**
     * @var string 用户id
     */
    protected string $userId = '';

    /**
     * @var string 任务模式
     */
    protected string $taskMode = 'chat';

    /**
     * @var string 项目ID
     */
    protected string $projectId = '';

    /**
     * 从实体创建 DTO.
     */
    public static function fromEntity(TopicEntity $entity): self
    {
        $dto = new self();
        $dto->setId((string) $entity->getId());
        $dto->setChatTopicId($entity->getChatTopicId());
        $dto->setTopicName($entity->getTopicName());
        $dto->setTaskStatus($entity->getCurrentTaskStatus()->value);
        $dto->setTaskMode($entity->getTaskMode());
        $dto->setProjectId($entity->getProjectId() ? (string) $entity->getProjectId() : '');
        return $dto;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): self
    {
        $this->id = $id;
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

    public function getTopicName(): string
    {
        return $this->topicName;
    }

    public function setTopicName(string $topicName): self
    {
        $this->topicName = $topicName;
        return $this;
    }

    public function getTaskStatus(): string
    {
        return $this->taskStatus;
    }

    public function setTaskStatus(string $taskStatus): self
    {
        $this->taskStatus = $taskStatus;
        return $this;
    }

    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getTaskMode(): string
    {
        return $this->taskMode;
    }

    public function setTaskMode(string $taskMode): self
    {
        $this->taskMode = $taskMode;
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
     * 从数组创建DTO.
     */
    public static function fromArray(array $data): self
    {
        $dto = new self();
        $dto->id = (string) $data['id'];
        $dto->chatTopicId = $data['chat_topic_id'] ?? '';
        $dto->topicName = $data['topic_name'] ?? $data['name'] ?? '';
        $dto->taskStatus = $data['task_status'] ?? $data['current_task_status'] ?? '';
        $dto->userId = $data['user_id'] ?? '';
        $dto->taskMode = $data['task_mode'] ?? 'chat';
        $dto->projectId = isset($data['project_id']) ? (string) $data['project_id'] : '';

        return $dto;
    }

    /**
     * 转换为数组.
     * 输出保持下划线命名，以保持API兼容性.
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'chat_topic_id' => $this->chatTopicId,
            'topic_name' => $this->topicName,
            'task_status' => $this->taskStatus,
            'user_id' => $this->userId,
            'task_mode' => $this->taskMode,
            'project_id' => $this->projectId,
        ];
    }
}
