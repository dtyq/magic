<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\DTO;

use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;

class MagicOrganizationEnvDTO extends MagicEnvironmentEntity
{
    protected string $orgEnvId;

    protected string $loginCode;

    protected string $magicOrganizationCode;

    protected string $originOrganizationCode;

    protected int $environmentId;

    protected ?MagicEnvironmentEntity $magicEnvironmentEntity = null;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function getMagicEnvironmentEntity(): ?MagicEnvironmentEntity
    {
        return $this->magicEnvironmentEntity;
    }

    public function setMagicEnvironmentEntity(?MagicEnvironmentEntity $magicEnvironmentEntity): void
    {
        $this->magicEnvironmentEntity = $magicEnvironmentEntity;
    }

    public function getOrgEnvId(): string
    {
        return $this->orgEnvId;
    }

    public function setOrgEnvId(string $orgEnvId): void
    {
        $this->orgEnvId = $orgEnvId;
    }

    public function getLoginCode(): string
    {
        return $this->loginCode;
    }

    public function setLoginCode(string $loginCode): void
    {
        $this->loginCode = $loginCode;
    }

    public function getMagicOrganizationCode(): string
    {
        return $this->magicOrganizationCode;
    }

    public function setMagicOrganizationCode(string $magicOrganizationCode): void
    {
        $this->magicOrganizationCode = $magicOrganizationCode;
    }

    public function getOriginOrganizationCode(): string
    {
        return $this->originOrganizationCode;
    }

    public function setOriginOrganizationCode(string $originOrganizationCode): void
    {
        $this->originOrganizationCode = $originOrganizationCode;
    }

    public function getEnvironmentId(): int
    {
        return $this->environmentId;
    }

    public function setEnvironmentId(int $environmentId): void
    {
        $this->environmentId = $environmentId;
    }
}
