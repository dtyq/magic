<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\Assembler;

use App\Domain\Chat\Entity\MagicTopicEntity;
use App\Domain\Chat\Entity\MagicTopicMessageEntity;

class TopicAssembler
{
    public static function getTopicEntity(array $topic): MagicTopicEntity
    {
        $topicEntity = new MagicTopicEntity();
        $topicEntity->setId($topic['id']);
        $topicEntity->setTopicId($topic['topic_id']);
        $topicEntity->setConversationId($topic['conversation_id']);
        $topicEntity->setName($topic['name']);
        $topicEntity->setDescription($topic['description']);
        $topicEntity->setOrganizationCode($topic['organization_code']);
        $topicEntity->setCreatedAt($topic['created_at']);
        $topicEntity->setUpdatedAt($topic['updated_at']);
        return $topicEntity;
    }

    /**
     * @return array<MagicTopicEntity>
     */
    public static function getTopicEntities(array $topics): array
    {
        $topicEntities = [];
        foreach ($topics as $topic) {
            $topicEntities[] = self::getTopicEntity($topic);
        }
        return $topicEntities;
    }

    public static function getTopicMessageEntity(array $topicMessage): MagicTopicMessageEntity
    {
        return new MagicTopicMessageEntity($topicMessage);
    }

    /**
     * @return array<MagicTopicMessageEntity>
     */
    public static function getTopicMessageEntities(array $topicMessages): array
    {
        $topicMessageEntities = [];
        foreach ($topicMessages as $topicMessage) {
            $topicMessageEntities[] = self::getTopicMessageEntity($topicMessage);
        }
        return $topicMessageEntities;
    }
}
