<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use DateTime;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id 雪花ID
 * @property string $organization_code 组织编码
 * @property string $code 唯一编码
 * @property string $name Agent名称
 * @property string $description Agent描述
 * @property array $icon Agent图标
 * @property array $prompt 系统提示词
 * @property array $tools 工具列表
 * @property int $type 智能体类型
 * @property bool $enabled 是否启用
 * @property string $creator 创建者
 * @property DateTime $created_at 创建时间
 * @property string $modifier 修改者
 * @property DateTime $updated_at 更新时间
 * @property null|DateTime $deleted_at 删除时间
 */
class SuperMagicAgentModel extends AbstractModel
{
    use Snowflake;
    use SoftDeletes;

    protected ?string $table = 'magic_super_magic_agents';

    protected array $fillable = [
        'id',
        'organization_code',
        'code',
        'name',
        'description',
        'icon',
        'prompt',
        'tools',
        'type',
        'enabled',
        'creator',
        'created_at',
        'modifier',
        'updated_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'code' => 'string',
        'name' => 'string',
        'description' => 'string',
        'icon' => 'array',
        'prompt' => 'array',
        'tools' => 'array',
        'type' => 'integer',
        'enabled' => 'boolean',
        'creator' => 'string',
        'modifier' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
