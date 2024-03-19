<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use Carbon\Carbon;
use Hyperf\Database\Model\SoftDeletes;

/**
 * @property int $id 主键 ID
 * @property string $organization_code 归属组织编码
 * @property array $name_i18n 分类名称（多语言）
 * @property null|string $logo Logo 图片 URL
 * @property int $sort_order 排序权重
 * @property string $creator_id 创建者用户 ID
 * @property Carbon $created_at 创建时间
 * @property Carbon $updated_at 更新时间
 * @property null|Carbon $deleted_at 软删除时间
 */
class AgentCategoryModel extends AbstractModel
{
    use SoftDeletes;

    protected ?string $table = 'magic_super_magic_agent_categories';

    protected array $fillable = [
        'id',
        'organization_code',
        'name_i18n',
        'logo',
        'sort_order',
        'creator_id',
    ];

    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'name_i18n' => 'array',
        'logo' => 'string',
        'sort_order' => 'integer',
        'creator_id' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
