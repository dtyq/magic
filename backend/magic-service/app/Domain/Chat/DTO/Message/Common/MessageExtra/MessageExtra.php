<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\SuperAgentExtra;
use App\Infrastructure\Core\AbstractDTO;

class MessageExtra extends AbstractDTO
{
    protected ?SuperAgentExtra $superAgent;

    public function __construct(?array $data = null)
    {
        if (isset($data['super_agent'])) {
            $this->superAgent = new SuperAgentExtra($data['super_agent']);
        }
        parent::__construct();
    }

    public function getSuperAgent(): ?SuperAgentExtra
    {
        return $this->superAgent ?? null;
    }

    public function setSuperAgent(null|array|SuperAgentExtra $superAgent): void
    {
        if ($superAgent instanceof SuperAgentExtra) {
            $this->superAgent = $superAgent;
        } elseif (is_array($superAgent)) {
            $this->superAgent = new SuperAgentExtra($superAgent);
        } else {
            $this->superAgent = null;
        }
    }
}
