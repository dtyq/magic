<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Service\ThirdPlatformChat;

use App\Domain\Chat\DTO\Message\MessageInterface;

interface ThirdPlatformChatInterface
{
    public function parseChatParam(array $params): ThirdPlatformChatMessage;

    public function sendMessage(ThirdPlatformChatMessage $thirdPlatformChatMessage, MessageInterface $message): void;

    public function getThirdPlatformUserIdByMobiles(string $mobile): string;

    public function createSceneGroup(ThirdPlatformCreateSceneGroup $params): string;

    public function createGroup(ThirdPlatformCreateGroup $params): string;
}
