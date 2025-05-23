<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use DateTime;
use Hyperf\Snowflake\Concern\Snowflake;

/**
 * @property int $id 主键ID
 * @property string $organization_code 组织编码
 * @property string $mcp_server_code 关联的mcp服务code
 * @property string $name 工具名称
 * @property string $description 工具描述
 * @property int $source 工具来源
 * @property string $rel_code 关联的工具code
 * @property string $rel_version_code 关联的工具版本code
 * @property string $version 工具版本
 * @property bool $enabled 是否启用
 * @property array $options 工具配置
 * @property array $rel_info 关联的信息
 * @property string $creator 创建者
 * @property DateTime $created_at 创建时间
 * @property string $modifier 修改者
 * @property DateTime $updated_at 更新时间
 */
class MCPServerToolModel extends AbstractModel
{
    use Snowflake;

    protected ?string $table = 'magic_mcp_server_tools';

    protected array $fillable = [
        'id',
        'organization_code',
        'mcp_server_code',
        'name',
        'description',
        'source',
        'rel_code',
        'rel_version_code',
        'version',
        'enabled',
        'options',
        'rel_info',
        'creator',
        'created_at',
        'modifier',
        'updated_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'mcp_server_code' => 'string',
        'name' => 'string',
        'description' => 'string',
        'source' => 'integer',
        'rel_code' => 'string',
        'rel_version_code' => 'string',
        'version' => 'string',
        'enabled' => 'boolean',
        'options' => 'json',
        'rel_info' => 'json',
        'creator' => 'string',
        'modifier' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
