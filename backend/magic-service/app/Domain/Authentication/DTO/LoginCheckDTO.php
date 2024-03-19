<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Authentication\DTO;

use App\Domain\Contact\Entity\AbstractEntity;
use App\Infrastructure\Core\Contract\Session\LoginCheckInterface;

class LoginCheckDTO extends AbstractEntity implements LoginCheckInterface
{
    protected string $loginCode = '';

    protected string $authorization = '';

    protected ?string $organizationCode = null;

    public function getLoginCode(): string
    {
        return $this->loginCode;
    }

    public function setLoginCode(string $loginCode): void
    {
        $this->loginCode = $loginCode;
    }

    public function getAuthorization(): string
    {
        return $this->authorization;
    }

    public function setAuthorization(string $authorization): void
    {
        $this->authorization = $authorization;
    }

    public function getOrganizationCode(): ?string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(?string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }
}
