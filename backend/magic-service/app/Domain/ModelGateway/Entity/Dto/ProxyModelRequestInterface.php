<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

interface ProxyModelRequestInterface
{
    public function getType(): string;

    public function getModel(): string;

    public function getIps(): array;

    public function getAccessToken(): string;

    public function getCallMethod(): string;

    public function getBusinessParam(string $key, bool $checkExists = false): mixed;

    public function addBusinessParam(string $key, mixed $value): void;

    public function getHeaderConfig(string $key, mixed $default = null): mixed;

    public function isEnableHighAvailability(): bool;

    public function setEnableHighAvailability(bool $enableHighAvailability): void;
}
