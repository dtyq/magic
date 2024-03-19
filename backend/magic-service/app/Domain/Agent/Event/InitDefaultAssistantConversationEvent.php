<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Event;

use App\Domain\Contact\Entity\MagicUserEntity;

class InitDefaultAssistantConversationEvent
{
    public function __construct(
        public MagicUserEntity $userEntity,
        public ?array $defaultConversationAICodes = null,
    ) {
    }

    public function getDefaultConversationAICodes(): ?array
    {
        return $this->defaultConversationAICodes;
    }

    public function setDefaultConversationAICodes(?array $defaultConversationAICodes): InitDefaultAssistantConversationEvent
    {
        $this->defaultConversationAICodes = $defaultConversationAICodes;
        return $this;
    }

    public function getUserEntity(): MagicUserEntity
    {
        return $this->userEntity;
    }

    public function setUserEntity(MagicUserEntity $userEntity): InitDefaultAssistantConversationEvent
    {
        $this->userEntity = $userEntity;
        return $this;
    }
}
