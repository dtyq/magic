<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

/**
 * 获取文件版本列表请求DTO.
 */
class GetFileVersionsRequestDTO extends AbstractRequestDTO
{
    /**
     * 页码（从1开始）.
     */
    public int $page = 1;

    /**
     * 每页数量.
     */
    public int $pageSize = 10;

    /**
     * 文件ID.
     */
    protected int $fileId = 0;

    public function getFileId(): int
    {
        return $this->fileId;
    }

    public function setFileId(int|string $value): void
    {
        $this->fileId = (int) $value;
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function setPage(int|string $value): void
    {
        $this->page = (int) $value;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function setPageSize(int|string $value): void
    {
        $this->pageSize = (int) $value;
    }

    /**
     * 获取验证规则.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'id' => 'required|integer|min:1',
            'page' => 'integer|min:1',
            'page_size' => 'integer|min:1|max:100',
        ];
    }

    /**
     * 获取验证失败的自定义错误信息.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'id.required' => 'File ID cannot be empty',
            'id.integer' => 'File ID must be an integer',
            'id.min' => 'File ID must be greater than 0',
            'page.integer' => 'Page must be an integer',
            'page.min' => 'Page must be greater than 0',
            'page_size.integer' => 'Page size must be an integer',
            'page_size.min' => 'Page size must be greater than 0',
            'page_size.max' => 'Page size cannot exceed 100',
        ];
    }
}
