<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

class PersonaAvatarRequestDTO extends AbstractRequestDTO
{
    public function getType(): string
    {
        return 'persona_avatar';
    }
}
