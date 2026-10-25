<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;

class SlidesTemplateFavoriteModel extends AbstractModel
{
    protected ?string $table = 'magic_slides_template_favorites';

    protected array $fillable = [
        'organization_code',
        'user_id',
        'slide_template_code',
    ];

    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'user_id' => 'string',
        'slide_template_code' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
