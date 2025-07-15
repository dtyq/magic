<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Domain\Chat\Entity\AbstractEntity;

class UserInfoRequestDTO extends AbstractEntity
{
    protected string $uid = '';

    public function __construct(array $data = [])
    {
        parent::__construct($data);

        $this->uid = (string) ($data['uid'] ?? '');
    }

    public function getUid(): string
    {
        return $this->uid ?: uniqid('magic_', true);
    }

    public function setUid(string $uid): void
    {
        $this->uid = $uid;
    }
}
