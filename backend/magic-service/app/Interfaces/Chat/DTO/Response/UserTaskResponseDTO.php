<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\DTO\Response;

use DateTime;
use Dtyq\TaskScheduler\Entity\TaskSchedulerCrontab;

class UserTaskResponseDTO
{
    private string $id;

    private string $name;

    private string $creator;

    private string $day;

    private string $time;

    private string $type;

    private array $value;

    private DateTime $created_at;

    private string $topic_id;

    private string $conversation_id;

    private string $agent_id;

    // 实体转DTO
    public static function entityToDTO(TaskSchedulerCrontab $taskSchedulerCrontab): UserTaskResponseDTO
    {
        $userTaskResponseDTO = new UserTaskResponseDTO();
        $userTaskResponseDTO->setId((string) $taskSchedulerCrontab->getId());
        $userTaskResponseDTO->setName($taskSchedulerCrontab->getName());
        $userTaskResponseDTO->setCreator($taskSchedulerCrontab->getCreator());
        $callbackParams = $taskSchedulerCrontab->getCallbackParams();
        $userTaskResponseDTO->setType($callbackParams['user_task']['type'] ?? '');
        $userTaskResponseDTO->setDay($callbackParams['user_task']['day'] ?? '');
        $userTaskResponseDTO->setTime($callbackParams['user_task']['time'] ?? '');
        $userTaskResponseDTO->setValue($callbackParams['user_task']['value'] ?? []);
        $userTaskResponseDTO->setCreatedAt($taskSchedulerCrontab->getCreatedAt());
        $userTaskResponseDTO->setTopicId($callbackParams['user_task']['topic_id'] ?? '');
        $userTaskResponseDTO->setConversationId($callbackParams['user_task']['conversation_id'] ?? '');
        $userTaskResponseDTO->setAgentId($callbackParams['user_task']['agent_id'] ?? '');

        return $userTaskResponseDTO;
    }

    public function toArray(): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'creator' => $this->creator,
            'day' => $this->day,
            'time' => $this->time,
            'type' => $this->type,
            'value' => $this->value,
            'topic_id' => $this->topic_id,
            'conversation_id' => $this->conversation_id,
            'agent_id' => $this->agent_id,
            'created_at' => ! empty($this->created_at) ? $this->created_at->format('Y-m-d H:i:s') : '',
        ];
    }

    /**
     * Get the value of id.
     */
    public function getId(): string
    {
        return $this->id;
    }

    /**
     * Set the value of id.
     */
    public function setId(string $id): self
    {
        $this->id = $id;

        return $this;
    }

    /**
     * Get the value of name.
     */
    public function getName(): string
    {
        return $this->name;
    }

    /**
     * Set the value of name.
     */
    public function setName(string $name): self
    {
        $this->name = $name;

        return $this;
    }

    /**
     * Get the value of creator.
     */
    public function getCreator(): string
    {
        return $this->creator;
    }

    /**
     * Set the value of creator.
     */
    public function setCreator(string $creator): self
    {
        $this->creator = $creator;

        return $this;
    }

    /**
     * Get the value of day.
     */
    public function getDay(): string
    {
        return $this->day;
    }

    /**
     * Set the value of day.
     */
    public function setDay(string $day): self
    {
        $this->day = $day;

        return $this;
    }

    /**
     * Get the value of time.
     */
    public function getTime(): string
    {
        return $this->time;
    }

    /**
     * Set the value of time.
     */
    public function setTime(string $time): self
    {
        $this->time = $time;

        return $this;
    }

    /**
     * Get the value of type.
     */
    public function getType(): string
    {
        return $this->type;
    }

    /**
     * Set the value of type.
     */
    public function setType(string $type): self
    {
        $this->type = $type;

        return $this;
    }

    /**
     * Get the value of value.
     */
    public function getValue(): array
    {
        return $this->value;
    }

    /**
     * Set the value of value.
     */
    public function setValue(array $value): self
    {
        $this->value = $value;

        return $this;
    }

    /**
     * Get the value of created_at.
     */
    public function getCreatedAt(): DateTime
    {
        return $this->created_at;
    }

    /**
     * Set the value of created_at.
     */
    public function setCreatedAt(DateTime $created_at): self
    {
        $this->created_at = $created_at;

        return $this;
    }

    /**
     * Get the value of topic_id.
     */
    public function getTopicId(): string
    {
        return $this->topic_id;
    }

    /**
     * Set the value of topic_id.
     */
    public function setTopicId(string $topic_id): self
    {
        $this->topic_id = $topic_id;

        return $this;
    }

    /**
     * Get the value of conversation_id.
     */
    public function getConversationId(): string
    {
        return $this->conversation_id;
    }

    /**
     * Set the value of conversation_id.
     */
    public function setConversationId(string $conversation_id): self
    {
        $this->conversation_id = $conversation_id;

        return $this;
    }

    /**
     * Get the value of agent_id.
     */
    public function getAgentId(): string
    {
        return $this->agent_id;
    }

    /**
     * Set the value of agent_id.
     */
    public function setAgentId(string $agent_id): self
    {
        $this->agent_id = $agent_id;

        return $this;
    }
}
