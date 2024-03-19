<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Factory;

use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MagicMessageStatus;

class MagicSeqFactory
{
    public static function arrayToEntity(array $seq): MagicSeqEntity
    {
        $entity = new MagicSeqEntity();
        $entity->setId($seq['id']);
        $entity->setOrganizationCode($seq['organization_code']);
        isset($seq['object_type']) && $entity->setObjectType(ConversationType::tryFrom($seq['object_type']));
        $entity->setObjectId($seq['object_id']);
        $entity->setSeqId($seq['seq_id']);
        $entity->setMagicMessageId($seq['magic_message_id']);
        $entity->setMessageId($seq['message_id']);
        $entity->setReferMessageId($seq['refer_message_id']);
        $entity->setSenderMessageId($seq['sender_message_id']);
        $entity->setConversationId($seq['conversation_id']);
        isset($seq['status']) && $entity->setStatus(MagicMessageStatus::tryFrom($seq['status']));
        $entity->setCreatedAt($seq['created_at']);
        $entity->setUpdatedAt($seq['updated_at']);
        $entity->setAppMessageId($seq['app_message_id']);
        return $entity;
    }
}
