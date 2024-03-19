<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Factory;

use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationStatus;
use App\Domain\Chat\Entity\ValueObject\ConversationType;

class MagicConversationFactory
{
    public static function arrayToEntity(array $conversation): MagicConversationEntity
    {
        $entity = new MagicConversationEntity();
        $entity->setId($conversation['id']);
        $entity->setUserId($conversation['user_id']);
        $entity->setUserOrganizationCode($conversation['user_organization_code']);
        $entity->setReceiveType(ConversationType::tryFrom($conversation['receive_type']));
        $entity->setReceiveId($conversation['receive_id']);
        $entity->setReceiveOrganizationCode($conversation['receive_organization_code']);
        $entity->setIsNotDisturb($conversation['is_not_disturb']);
        $entity->setIsTop($conversation['is_top']);
        $entity->setIsMark($conversation['is_mark']);
        if (isset($conversation['status']) && ConversationStatus::tryFrom($conversation['status'])) {
            $entity->setStatus(ConversationStatus::tryFrom($conversation['status']));
        }
        return $entity;
    }
}
