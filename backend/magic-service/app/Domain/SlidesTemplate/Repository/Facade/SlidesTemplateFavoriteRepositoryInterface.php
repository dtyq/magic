<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Repository\Facade;

interface SlidesTemplateFavoriteRepositoryInterface
{
    public function addIfAbsent(string $organizationCode, string $userId, string $slideTemplateCode): void;

    public function deleteForUser(string $organizationCode, string $userId, string $slideTemplateCode): void;

    public function deleteBySlideTemplateCode(string $slideTemplateCode): void;
}
