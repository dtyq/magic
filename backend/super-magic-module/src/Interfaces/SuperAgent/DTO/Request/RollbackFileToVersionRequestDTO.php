<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * 文件回滚到指定版本请求DTO.
 */
class RollbackFileToVersionRequestDTO extends AbstractRequestDTO
{
    /**
     * 文件ID（从路由参数获取）.
     */
    protected int $fileId = 0;

    /**
     * 目标版本号.
     */
    protected int $version = 0;

    public function getFileId(): int
    {
        return $this->fileId;
    }

    public function setFileId(int|string $value): void
    {
        $this->fileId = (int) $value;
    }

    public function getVersion(): int
    {
        return $this->version;
    }

    public function setVersion(int|string $value): void
    {
        $this->version = (int) $value;
    }

    /**
     * 获取验证规则.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'file_id' => 'required|integer|min:1',
            'version' => 'required|integer|min:1',
        ];
    }

    /**
     * 获取验证失败的自定义错误信息.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'file_id.required' => 'File ID cannot be empty',
            'file_id.integer' => 'File ID must be an integer',
            'file_id.min' => 'File ID must be greater than 0',
            'version.required' => 'Version cannot be empty',
            'version.integer' => 'Version must be an integer',
            'version.min' => 'Version must be greater than 0',
        ];
    }
}
