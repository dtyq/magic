<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn;

enum BuiltInToolSet: string
{
    case FileBox = 'file_box';
    case AtomicNode = 'atomic_node';
    case AIImage = 'ai_image';
    case InternetSearch = 'internet_search';
    case Crontab = 'crontab';
    case Message = 'message';

    public function getCode(): string
    {
        return $this->value;
    }
}
