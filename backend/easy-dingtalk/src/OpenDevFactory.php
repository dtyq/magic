<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk;

use Dtyq\EasyDingTalk\Kernel\Contracts\Factory\FactoryAbstract;
use Dtyq\EasyDingTalk\OpenDev\Endpoint\Calendar\CalendarEndpoint;
use Dtyq\EasyDingTalk\OpenDev\Endpoint\ChatBot\ChatBotEndpoint;
use Dtyq\EasyDingTalk\OpenDev\Endpoint\Conversation\ConversationEndpoint;
use Dtyq\EasyDingTalk\OpenDev\Endpoint\Department\DepartmentEndpoint;
use Dtyq\EasyDingTalk\OpenDev\Endpoint\DingCallback\DingCallbackEndpoint;
use Dtyq\EasyDingTalk\OpenDev\Endpoint\Oauth2\AccessTokenEndpoint;
use Dtyq\EasyDingTalk\OpenDev\Endpoint\User\UserEndpoint;

/**
 * @property AccessTokenEndpoint $accessTokenEndpoint
 * @property DingCallbackEndpoint $dingCallbackEndpoint
 * @property DepartmentEndpoint $departmentEndpoint
 * @property UserEndpoint $userEndpoint
 * @property CalendarEndpoint $calendarEndpoint
 * @property ChatBotEndpoint $chatBotEndpoint
 * @property ConversationEndpoint $conversationEndpoint
 */
class OpenDevFactory extends FactoryAbstract
{
    protected function getEndpoints(): array
    {
        return [
            AccessTokenEndpoint::class,
            DingCallbackEndpoint::class,
            DepartmentEndpoint::class,
            UserEndpoint::class,
            CalendarEndpoint::class,
            ChatBotEndpoint::class,
            ConversationEndpoint::class,
        ];
    }
}
