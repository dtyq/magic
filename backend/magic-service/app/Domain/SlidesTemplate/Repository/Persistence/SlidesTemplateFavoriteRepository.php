<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Repository\Persistence;

use App\Domain\SlidesTemplate\Repository\Facade\SlidesTemplateFavoriteRepositoryInterface;
use App\Domain\SlidesTemplate\Repository\Persistence\Model\SlidesTemplateFavoriteModel;

class SlidesTemplateFavoriteRepository implements SlidesTemplateFavoriteRepositoryInterface
{
    public function addIfAbsent(string $organizationCode, string $userId, string $slideTemplateCode): void
    {
        SlidesTemplateFavoriteModel::query()->firstOrCreate([
            'organization_code' => $organizationCode,
            'user_id' => $userId,
            'slide_template_code' => $slideTemplateCode,
        ]);
    }

    public function deleteForUser(string $organizationCode, string $userId, string $slideTemplateCode): void
    {
        SlidesTemplateFavoriteModel::query()
            ->where('organization_code', $organizationCode)
            ->where('user_id', $userId)
            ->where('slide_template_code', $slideTemplateCode)
            ->delete();
    }

    public function deleteBySlideTemplateCode(string $slideTemplateCode): void
    {
        SlidesTemplateFavoriteModel::query()
            ->where('slide_template_code', $slideTemplateCode)
            ->delete();
    }
}
