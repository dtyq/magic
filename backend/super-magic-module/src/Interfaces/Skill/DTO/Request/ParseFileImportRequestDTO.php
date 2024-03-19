<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

/**
 * 解析文件导入请求 DTO.
 */
class ParseFileImportRequestDTO extends AbstractRequestDTO
{
    /**
     * 文件在对象存储中的 key.
     */
    public string $fileKey = '';

    /**
     * 获取文件 key.
     */
    public function getFileKey(): string
    {
        return $this->fileKey;
    }

    /**
     * 获取验证规则.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'file_key' => 'required|string',
        ];
    }

    /**
     * 获取验证错误消息.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'file_key.required' => __('skill.file_key_required'),
            'file_key.string' => __('skill.file_key_must_be_string'),
        ];
    }
}
