<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Factory;

use App\Domain\Agent\Entity\MagicBotThirdPlatformChatEntity;
use App\Domain\Agent\Entity\ValueObject\ThirdPlatformChat\ThirdPlatformChatType;
use App\Domain\Agent\Repository\Persistence\Model\MagicBotThirdPlatformChatModel;

class MagicAgentThirdPlatformChatFactory
{
    public static function modelToEntity(MagicBotThirdPlatformChatModel $model): MagicBotThirdPlatformChatEntity
    {
        $entity = new MagicBotThirdPlatformChatEntity();
        $entity->setId($model->id);
        $entity->setBotId($model->bot_id);
        $entity->setKey($model->key);
        $entity->setType(ThirdPlatformChatType::from($model->type));
        $entity->setEnabled($model->enabled);
        $entity->setOptions($model->options);
        $entity->setIdentification($model->identification);
        return $entity;
    }
}
