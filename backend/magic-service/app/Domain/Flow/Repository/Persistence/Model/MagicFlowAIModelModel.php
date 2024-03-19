<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence\Model;

use App\Infrastructure\Core\AbstractModel;
use App\Infrastructure\Util\Aes\AesUtil;
use DateTime;
use Hyperf\Codec\Json;
use Hyperf\Snowflake\Concern\Snowflake;

use function Hyperf\Config\config;

/**
 * @property int $id
 * @property string $name
 * @property string $label
 * @property string $icon
 * @property string $model_name
 * @property array $tags
 * @property array $default_configs
 * @property bool $enabled
 * @property bool $display
 * @property string $implementation
 * @property array $implementation_config
 * @property bool $support_embedding
 * @property bool $support_multi_modal
 * @property int $vector_size
 * @property int $max_tokens
 * @property string $organization_code
 * @property string $created_uid
 * @property DateTime $created_at
 * @property string $updated_uid
 * @property DateTime $updated_at
 * @property DateTime $deleted_at
 */
class MagicFlowAIModelModel extends AbstractModel
{
    use Snowflake;

    protected ?string $table = 'magic_flow_ai_models';

    protected array $fillable = [
        'id', 'name', 'label', 'icon', 'model_name', 'tags', 'default_configs', 'enabled', 'display', 'implementation', 'implementation_config', 'support_embedding', 'vector_size', 'support_multi_modal', 'max_tokens',
        'organization_code', 'created_uid', 'created_at', 'updated_uid', 'updated_at', 'deleted_at',
    ];

    protected array $casts = [
        'id' => 'integer',
        'name' => 'string',
        'label' => 'string',
        'icon' => 'string',
        'model_name' => 'string',
        'tags' => 'array',
        'default_configs' => 'array',
        'enabled' => 'boolean',
        'display' => 'boolean',
        'implementation' => 'string',
        'implementation_config' => 'string',
        'support_embedding' => 'boolean',
        'support_multi_modal' => 'boolean',
        'max_tokens' => 'integer',
        'vector_size' => 'integer',
        'organization_code' => 'string',
        'created_uid' => 'string',
        'created_at' => 'datetime',
        'updated_uid' => 'string',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function setImplementationConfigAttribute(array $config): void
    {
        $this->attributes['implementation_config'] = AesUtil::encode($this->_getAesKey(strval($this->attributes['name'])), Json::encode($config));
    }

    public function getImplementationConfigAttribute(string $config): array
    {
        return Json::decode(AesUtil::decode($this->_getAesKey(strval($this->attributes['name'])), $config));
    }

    /**
     * aes key加盐.
     */
    private function _getAesKey(string $salt): string
    {
        return config('magic_flows.model_aes_key', '') . $salt;
    }
}
