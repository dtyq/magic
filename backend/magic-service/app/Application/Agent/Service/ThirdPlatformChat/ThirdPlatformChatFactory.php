<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Service\ThirdPlatformChat;

use App\Application\Agent\Service\ThirdPlatformChat\DingRobot\DingRobotChat;
use App\Application\Agent\Service\ThirdPlatformChat\FeiShuRobot\FeiShuRobotChat;
use App\Application\Agent\Service\ThirdPlatformChat\WeChatRobot\WeChatRobotChat;
use App\Domain\Agent\Entity\MagicBotThirdPlatformChatEntity;
use App\Domain\Agent\Entity\ValueObject\ThirdPlatformChat\ThirdPlatformChatType;

class ThirdPlatformChatFactory
{
    public static array $containers = [];

    public static function make(MagicBotThirdPlatformChatEntity $entity): ThirdPlatformChatInterface
    {
        if (isset(self::$containers[$entity->getId()])) {
            return self::$containers[$entity->getId()];
        }
        $thirdPlatformChat = match ($entity->getType()) {
            ThirdPlatformChatType::DingRobot => make(DingRobotChat::class, [$entity->getOptions()]),
            ThirdPlatformChatType::WeChatRobot => make(WeChatRobotChat::class, [$entity->getOptions()]),
            ThirdPlatformChatType::FeiShuRobot => make(FeiShuRobotChat::class, [$entity->getOptions()]),
        };
        self::$containers[$entity->getId()] = $thirdPlatformChat;
        return $thirdPlatformChat;
    }

    public static function remove(string $id): void
    {
        unset(self::$containers[$id]);
    }
}
