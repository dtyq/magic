<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Repository\Persistence\Model;

use App\Infrastructure\Util\Aes\AesUtil;
use DateTime;
use Hyperf\Codec\Json;
use Hyperf\Database\Model\SoftDeletes;
use Hyperf\DbConnection\Model\Model;
use Hyperf\Snowflake\Concern\Snowflake;

use function Hyperf\Config\config;

/**
 * @property string $id
 * @property string $bot_id
 * @property string $key
 * @property string $type
 * @property bool $enabled
 * @property array $options
 * @property string $identification
 * @property DateTime $deleted_at
 */
class MagicBotThirdPlatformChatModel extends Model
{
    use SoftDeletes;
    use Snowflake;

    public bool $timestamps = false;

    protected ?string $table = 'magic_bot_third_platform_chat';

    protected array $fillable = [
        'id',
        'bot_id',
        'key',
        'type',
        'enabled',
        'options',
        'identification',
        'deleted_at',
    ];

    protected array $casts = [
        'id' => 'string',
        'bot_id' => 'string',
        'key' => 'string',
        'type' => 'string',
        'enabled' => 'boolean',
        'options' => 'string',
        'identification' => 'string',
        'deleted_at' => 'datetime',
    ];

    public function setOptionsAttribute(array $config): void
    {
        $this->attributes['options'] = AesUtil::encode($this->_getAesKey(strval($this->attributes['key'])), Json::encode($config));
    }

    public function getOptionsAttribute(string $config): array
    {
        return Json::decode(AesUtil::decode($this->_getAesKey(strval($this->attributes['key'])), $config));
    }

    /**
     * aes key加盐.
     */
    private function _getAesKey(string $salt): string
    {
        return config('magic_flows.model_aes_key', '') . $salt;
    }
}
