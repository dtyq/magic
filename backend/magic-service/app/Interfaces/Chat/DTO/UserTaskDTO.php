<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\DTO;

use App\Infrastructure\Core\AbstractDTO;

class UserTaskDTO extends AbstractDTO
{
    protected string $name;

    protected string $description;

    protected string $agentId = '';

    protected string $type;

    protected string $day;

    protected string $time;

    // 主题id
    protected string $topicId = '';

    protected array $value;

    protected string $creator;

    protected string $nickname;

    protected string $conversationId = '';

    protected string $agentUserId = '';

    // 当前用户所处的环境id
    protected int $magicEnvId = 0;

    public function __construct(?array $data = null)
    {
        parent::__construct($data);
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

    public function getAgentId(): string
    {
        return $this->agentId;
    }

    public function setAgentId(string $agentId): self
    {
        $this->agentId = $agentId;

        return $this;
    }

    /**
     * Get the value of topicId.
     */
    public function getTopicId(): string
    {
        return $this->topicId;
    }

    /**
     * Set the value of topicId.
     */
    public function setTopicId(string $topicId): self
    {
        $this->topicId = $topicId;

        return $this;
    }

    /**
     * Get the value of magicEnvId.
     */
    public function getMagicEnvId(): int
    {
        return $this->magicEnvId;
    }

    /**
     * Set the value of magicEnvId.
     */
    public function setMagicEnvId(int $magicEnvId): self
    {
        $this->magicEnvId = $magicEnvId;

        return $this;
    }

    /**
     * Get the value of nickname.
     */
    public function getNickname(): string
    {
        return $this->nickname;
    }

    /**
     * Set the value of nickname.
     */
    public function setNickname(string $nickname): self
    {
        $this->nickname = $nickname;

        return $this;
    }

    /**
     * Get the value of conversationId.
     */
    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    /**
     * Set the value of conversationId.
     */
    public function setConversationId(string $conversationId): self
    {
        $this->conversationId = $conversationId;

        return $this;
    }

    /**
     * Get the value of agentUserId.
     */
    public function getAgentUserId(): string
    {
        return $this->agentUserId;
    }

    /**
     * Set the value of agentUserId.
     */
    public function setAgentUserId(string $agentUserId): self
    {
        $this->agentUserId = $agentUserId;

        return $this;
    }

    /**
     * Get the value of description.
     */
    public function getDescription(): string
    {
        return $this->description;
    }

    /**
     * Set the value of description.
     */
    public function setDescription(string $description): self
    {
        $this->description = $description;

        return $this;
    }
}
