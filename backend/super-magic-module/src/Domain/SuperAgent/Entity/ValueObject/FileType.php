<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

use InvalidArgumentException;

/**
 * 文件类型枚举.
 */
enum FileType: string
{
    /**
     * 用户上传.
     */
    case USER_UPLOAD = 'user_upload';

    /**
     * 处理过程.
     */
    case PROCESS = 'process';

    /**
     * 浏览器.
     */
    case BROWSER = 'browser';

    /**
     * 系统自动上传.
     */
    case SYSTEM_AUTO_UPLOAD = 'system_auto_upload';

    /**
     * 工具消息内容.
     */
    case TOOL_MESSAGE_CONTENT = 'tool_message_content';

    /**
     * 文档.
     */
    case DOCUMENT = 'document';

    /**
     * 自动同步.
     */
    case AUTO_SYNC = 'auto_sync';

    /**
     * 获取文件类型名称.
     */
    public function getName(): string
    {
        return match ($this) {
            self::USER_UPLOAD => '用户上传',
            self::PROCESS => '处理过程',
            self::BROWSER => '浏览器',
            self::SYSTEM_AUTO_UPLOAD => '系统自动上传',
            self::TOOL_MESSAGE_CONTENT => '工具消息内容',
            self::DOCUMENT => '文档',
            self::AUTO_SYNC => '自动同步',
        };
    }

    /**
     * 获取文件类型描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::USER_UPLOAD => '用户手动上传的文件',
            self::PROCESS => '在处理过程中产生的文件',
            self::BROWSER => '通过浏览器获取的文件',
            self::SYSTEM_AUTO_UPLOAD => '系统自动上传的文件',
            self::TOOL_MESSAGE_CONTENT => '工具消息中包含的文件内容',
            self::DOCUMENT => '文档类型的文件',
            self::AUTO_SYNC => '自动同步的文件',
        };
    }

    /**
     * 从字符串创建枚举实例.
     */
    public static function fromValue(string $value): self
    {
        return match ($value) {
            'user_upload' => self::USER_UPLOAD,
            'process' => self::PROCESS,
            'browser' => self::BROWSER,
            'system_auto_upload' => self::SYSTEM_AUTO_UPLOAD,
            'tool_message_content' => self::TOOL_MESSAGE_CONTENT,
            'document' => self::DOCUMENT,
            'auto_sync' => self::AUTO_SYNC,
            // 兜底：未知值统一转为 USER_UPLOAD（处理脏数据）
            default => self::USER_UPLOAD,
        };
    }

    /**
     * 获取所有可用的文件类型选项.
     */
    public static function getAllOptions(): array
    {
        return [
            self::USER_UPLOAD->value => self::USER_UPLOAD->getName(),
            self::PROCESS->value => self::PROCESS->getName(),
            self::BROWSER->value => self::BROWSER->getName(),
            self::SYSTEM_AUTO_UPLOAD->value => self::SYSTEM_AUTO_UPLOAD->getName(),
            self::TOOL_MESSAGE_CONTENT->value => self::TOOL_MESSAGE_CONTENT->getName(),
            self::DOCUMENT->value => self::DOCUMENT->getName(),
            self::AUTO_SYNC->value => self::AUTO_SYNC->getName(),
        ];
    }

    /**
     * 判断是否为有效的文件类型值
     */
    public static function isValid(string $value): bool
    {
        try {
            self::fromValue($value);
            return true;
        } catch (InvalidArgumentException) {
            return false;
        }
    }
}
