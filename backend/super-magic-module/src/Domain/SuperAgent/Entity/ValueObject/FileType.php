<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

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
     * 目录.
     */
    case DIRECTORY = 'directory';

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
            self::DIRECTORY => '目录',
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
            self::DIRECTORY => '目录',
        };
    }
}
