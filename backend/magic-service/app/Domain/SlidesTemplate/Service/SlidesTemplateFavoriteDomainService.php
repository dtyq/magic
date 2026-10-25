<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Service;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Repository\Facade\SlidesTemplateFavoriteRepositoryInterface;

readonly class SlidesTemplateFavoriteDomainService
{
    public function __construct(
        private SlidesTemplateFavoriteRepositoryInterface $repository,
    ) {
    }

    public function favorite(SlidesTemplateDataIsolation $dataIsolation, string $slideTemplateCode): void
    {
        $this->repository->addIfAbsent(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
            $slideTemplateCode
        );
    }

    public function unfavorite(SlidesTemplateDataIsolation $dataIsolation, string $slideTemplateCode): void
    {
        $this->repository->deleteForUser(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
            $slideTemplateCode
        );
    }

    public function deleteBySlideTemplateCode(string $slideTemplateCode): void
    {
        $this->repository->deleteBySlideTemplateCode($slideTemplateCode);
    }
}
