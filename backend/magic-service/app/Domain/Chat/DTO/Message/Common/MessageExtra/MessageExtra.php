<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra;

use App\Infrastructure\Core\AbstractDTO;

class MessageExtra extends AbstractDTO
{
    protected ?SuperAgent $superAgent;

    public function __construct(?array $data = null)
    {
        if (isset($data['super_agent'])) {
            $this->superAgent = new SuperAgent($data['super_agent']);
        }
        parent::__construct();
    }

    public function getSuperAgent(): ?SuperAgent
    {
        return $this->superAgent ?? null;
    }

    public function setSuperAgent(null|array|SuperAgent $superAgent): void
    {
        if ($superAgent instanceof SuperAgent) {
            $this->superAgent = $superAgent;
        } elseif (is_array($superAgent)) {
            $this->superAgent = new SuperAgent($superAgent);
        } else {
            $this->superAgent = null;
        }
    }
}
