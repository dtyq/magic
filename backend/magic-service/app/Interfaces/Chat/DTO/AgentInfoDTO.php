<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\DTO;

use App\Infrastructure\Core\AbstractDTO;

class AgentInfoDTO extends AbstractDTO
{
    public string $botId;

    public string $agentId;

    public string $flowCode;

    public int $userOperation;
}
