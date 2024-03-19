<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * 创建文件版本请求 DTO.
 */
class CreateFileVersionRequestDTO extends AbstractRequestDTO
{
    /**
     * 文件Key.
     */
    protected string $fileKey = '';

    /**
     * 编辑类型.
     */
    protected int $editType = 1;

    public function getFileKey(): string
    {
        return $this->fileKey;
    }

    public function setFileKey(string $fileKey): void
    {
        $this->fileKey = $fileKey;
    }

    public function getEditType(): int
    {
        return $this->editType;
    }

    public function setEditType(int $editType): void
    {
        $this->editType = $editType;
    }

    /**
     * 获取验证规则.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'file_key' => 'required|string|max:500',
            'edit_type' => 'sometimes|integer|in:1,2',
        ];
    }

    /**
     * 获取验证失败的自定义错误信息.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'file_key.required' => 'File key cannot be empty',
            'file_key.string' => 'File key must be a string',
            'file_key.max' => 'File key cannot exceed 500 characters',
            'edit_type.integer' => 'Edit type must be an integer',
            'edit_type.in' => 'Edit type must be 1 (manual) or 2 (AI)',
        ];
    }
}
