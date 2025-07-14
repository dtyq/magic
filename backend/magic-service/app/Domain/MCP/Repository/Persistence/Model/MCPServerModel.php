<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use DateTime;
use Hyperf\Database\Model\Relations\HasMany;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id 雪花ID
 * @property string $organization_code 组织编码
 * @property string $code 唯一编码
 * @property string $name MCP服务名称
 * @property string $description MCP服务描述
 * @property string $icon MCP服务图标
 * @property string $type 服务类型 ('sse' 或 'stdio')
 * @property bool $enabled 是否启用
 * @property string $external_sse_url 外部SSE服务URL
 * @property null|array $service_config 服务配置
 * @property string $creator 创建者
 * @property DateTime $created_at 创建时间
 * @property string $modifier 修改者
 * @property DateTime $updated_at 更新时间
 */
class MCPServerModel extends AbstractModel
{
    use Snowflake;
    use SoftDeletes;

    protected ?string $table = 'magic_mcp_servers';

    protected array $fillable = [
        'id',
        'organization_code',
        'code',
        'name',
        'description',
        'icon',
        'type',
        'enabled',
        'external_sse_url',
        'service_config',
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
        'icon' => 'string',
        'type' => 'string',
        'enabled' => 'boolean',
        'external_sse_url' => 'string',
        'service_config' => 'array',
        'creator' => 'string',
        'modifier' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function tools(): HasMany
    {
        /* @phpstan-ignore-next-line */
        return $this->hasMany(MCPServerToolModel::class, 'mcp_server_code', 'code');
    }
}
