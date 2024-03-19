<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use DateTime;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string $description
 * @property string $icon
 * @property int $type
 * @property array $edges
 * @property array $nodes
 * @property string $tool_set_id
 * @property bool $enabled
 * @property string $version_code
 * @property string $organization_code
 * @property string $created_uid
 * @property DateTime $created_at
 * @property string $updated_uid
 * @property DateTime $updated_at
 * @property DateTime $deleted_at
 */
class MagicFlowModel extends AbstractModel
{
    use Snowflake;
    use SoftDeletes;

    protected ?string $table = 'magic_flows';

    protected array $fillable = [
        'id', 'code', 'name', 'description', 'icon', 'type', 'edges', 'nodes', 'global_variable', 'tool_set_id', 'enabled', 'version_code',
        'organization_code', 'created_uid', 'created_at', 'updated_uid', 'updated_at', 'deleted_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'code' => 'string',
        'name' => 'string',
        'description' => 'string',
        'icon' => 'string',
        'type' => 'integer',
        'edges' => 'json',
        'nodes' => 'json',
        'global_variable' => 'json',
        'tool_set_id' => 'string',
        'enabled' => 'bool',
        'version_code' => 'string',
        'organization_code' => 'string',
        'created_uid' => 'string',
        'created_at' => 'datetime',
        'updated_uid' => 'string',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
