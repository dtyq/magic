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
 * @property int $id 雪花ID
 * @property string $organization_code 组织编码
 * @property string $user_id 用户ID
 * @property string $mcp_server_id MCP服务ID
 * @property null|array $require_fields 必填字段
 * @property null|array $oauth2_auth_result OAuth2认证结果
 * @property null|array $additional_config 附加配置
 * @property string $creator 创建者
 * @property DateTime $created_at 创建时间
 * @property string $modifier 修改者
 * @property DateTime $updated_at 更新时间
 */
class MCPUserSettingModel extends AbstractModel
{
    use Snowflake;

    protected ?string $table = 'magic_mcp_user_settings';

    protected array $fillable = [
        'id',
        'organization_code',
        'user_id',
        'mcp_server_id',
        'require_fields',
        'oauth2_auth_result',
        'additional_config',
        'creator',
        'created_at',
        'modifier',
        'updated_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'organization_code' => 'string',
        'user_id' => 'string',
        'mcp_server_id' => 'string',
        'require_fields' => 'array',
        'oauth2_auth_result' => 'array',
        'additional_config' => 'array',
        'creator' => 'string',
        'modifier' => 'string',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
