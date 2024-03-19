<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence\Model;

use App\Domain\Flow\Entity\ValueObject\Type;
use App\Infrastructure\Core\AbstractModel;
use DateTime;
use Hyperf\Database\Model\Relations\HasMany;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string $description
 * @property string $icon
 * @property bool $enabled
 * @property string $organization_code
 * @property string $created_uid
 * @property DateTime $created_at
 * @property string $updated_uid
 * @property DateTime $updated_at
 */
class MagicFlowToolSetModel extends AbstractModel
{
    use Snowflake;
    use SoftDeletes;

    protected ?string $table = 'magic_flow_tool_sets';

    protected array $fillable = [
        'id', 'code', 'name', 'description', 'icon', 'enabled',
        'organization_code', 'created_uid', 'created_at', 'updated_uid', 'updated_at', 'deleted_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'code' => 'string',
        'name' => 'string',
        'description' => 'string',
        'icon' => 'string',
        'enabled' => 'bool',
        'organization_code' => 'string',
        'created_uid' => 'string',
        'created_at' => 'datetime',
        'updated_uid' => 'string',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function tools(): HasMany
    {
        /* @phpstan-ignore-next-line */
        return $this->hasMany(MagicFlowModel::class, 'tool_set_id', 'code')->where('type', Type::Tools->value);
    }
}
