<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;

/**
 * @property int $id 主键 ID
 * @property array $name_i18n 多语言名称
 * @property int $sort_order 排序权重
 * @property Carbon $created_at 创建时间
 * @property Carbon $updated_at 更新时间
 */
class SkillCategoryModel extends AbstractModel
{
    protected ?string $table = 'magic_skill_categories';

    protected array $fillable = [
        'id',
        'name_i18n',
        'sort_order',
    ];

    protected array $casts = [
        'id' => 'integer',
        'name_i18n' => 'array',
        'sort_order' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
