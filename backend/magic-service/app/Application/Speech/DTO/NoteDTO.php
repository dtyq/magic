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
        public string $fileExtension
    ) {
    }

    /**
     * 验证文件类型是否有效.
     */
    public function isValidFileType(): bool
    {
        // 支持的文件类型
        $supportedTypes = ['txt', 'md', 'json'];
        return in_array(strtolower($this->fileExtension), $supportedTypes, true);
    }

    /**
     * 获取文件扩展名.
     */
    public function getFileExtension(): string
    {
        return strtolower($this->fileExtension);
    }

    /**
     * 生成文件名.
     *
     * @param null|string $generatedTitle 生成的标题，如果提供则使用 {title}-笔记.{ext} 格式
     */
    public function generateFileName(?string $generatedTitle = null): string
    {
        if (! empty($generatedTitle)) {
            // 使用生成的标题格式：{title}-笔记.{ext}
            return sprintf('%s-%s.%s', $generatedTitle, trans('asr.file_names.note_suffix'), $this->getFileExtension());
        }

        // 回退到默认格式
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
     *
     * @param array $data 包含content和file_type的数组
     */
    public static function fromArray(array $data): self
    {
        return new self(
            $data['content'] ?? '',
            $data['file_type'] ?? 'md'
        );
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'content' => $this->content,
            'file_type' => $this->fileExtension,
        ];
    }
}
