<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request;

/**
 * 沙箱文件保存请求类
 * 用于调用沙箱的 /api/v1/files/edit 接口.
 */
class SaveFilesRequest
{
    private array $files;

    public function __construct(array $files)
    {
        $this->files = $files;
    }

    /**
     * 创建文件保存请求
     */
    public static function create(array $files): self
    {
        return new self($files);
    }

    /**
     * 从应用层数据创建请求
     */
    public static function fromFileData(array $fileDataList): self
    {
        $files = [];

        foreach ($fileDataList as $fileData) {
            $files[] = [
                'file_key' => $fileData['file_key'],
                'file_path' => $fileData['file_path'],
                'content' => $fileData['content'],
                'is_encrypted' => false,
            ];
        }

        return new self($files);
    }

    /**
     * 转换为数组格式（用于API调用）.
     */
    public function toArray(): array
    {
        return [
            'files' => $this->files,
        ];
    }

    /**
     * 获取文件列表.
     */
    public function getFiles(): array
    {
        return $this->files;
    }

    /**
     * 获取文件数量.
     */
    public function getFileCount(): int
    {
        return count($this->files);
    }
}
