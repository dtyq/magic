<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Hyperf\Database\Model\SoftDeletes;

class SkillCategoryRelationModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_skill_category_relations';

    protected array $fillable = [
        'id', 'organization_code', 'relation_type', 'relation_id', 'category_id',
    ];

    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'relation_id' => 'integer',
        'category_id' => 'integer',
    ];
}
