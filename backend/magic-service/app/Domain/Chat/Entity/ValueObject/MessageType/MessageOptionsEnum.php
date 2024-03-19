<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject\MessageType;

/**
 * 消息的可选项.
 */
enum MessageOptionsEnum: string
{
    //  消息的可选项
    case EDIT_MESSAGE_OPTIONS = 'edit_message_options';
}
