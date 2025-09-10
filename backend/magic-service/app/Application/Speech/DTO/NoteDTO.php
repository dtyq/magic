<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\DTO;

use function Hyperf\Translation\trans;

/**
 * 笔记DTO
 * 用于ASR总结中的笔记信息.
 */
readonly class NoteDTO
{
    public function __construct(
        public string $content,
        public string $fileType
    ) {
    }

    /**
     * 验证文件类型是否有效.
     */
    public function isValidFileType(): bool
    {
        // 支持的文件类型
        $supportedTypes = ['txt', 'md', 'json'];
        return in_array(strtolower($this->fileType), $supportedTypes, true);
    }

    /**
     * 获取文件扩展名.
     */
    public function getFileExtension(): string
    {
        return strtolower($this->fileType);
    }

    /**
     * 生成文件名.
     */
    public function generateFileName(): string
    {
        return sprintf('%s.%s', trans('asr.file_names.note_prefix'), $this->getFileExtension());
    }

    /**
     * 检查是否有内容.
     */
    public function hasContent(): bool
    {
        return ! empty(trim($this->content));
    }

    /**
     * 从数组创建实例.
     */
    public static function fromArray(array $data): self
    {
        return new self(
            $data['content'] ?? '',
            $data['file_type'] ?? 'txt'
        );
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'content' => $this->content,
            'file_type' => $this->fileType,
        ];
    }
}
