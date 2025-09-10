<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Constants;

/**
 * 项目操作动作常量.
 */
final class OperationAction
{
    // 项目操作
    public const CREATE_PROJECT = 'create_project';

    public const UPDATE_PROJECT = 'update_project';

    public const DELETE_PROJECT = 'delete_project';

    public const FORK_PROJECT = 'fork_project';

    // 话题操作
    public const CREATE_TOPIC = 'create_topic';

    public const UPDATE_TOPIC = 'update_topic';

    public const DELETE_TOPIC = 'delete_topic';

    public const RENAME_TOPIC = 'rename_topic';

    // 文件操作
    public const UPLOAD_FILE = 'upload_file';

    public const DELETE_FILE = 'delete_file';

    public const RENAME_FILE = 'rename_file';

    public const MOVE_FILE = 'move_file';

    public const SAVE_FILE_CONTENT = 'save_file_content';

    public const DELETE_DIRECTORY = 'delete_directory';

    public const BATCH_MOVE_FILE = 'batch_move_file';

    public const BATCH_DELETE_FILE = 'batch_delete_file';

    // 项目成员操作
    public const UPDATE_PROJECT_MEMBERS = 'update_project_members';

    // 项目快捷方式操作
    public const SET_PROJECT_SHORTCUT = 'set_project_shortcut';

    public const CANCEL_PROJECT_SHORTCUT = 'cancel_project_shortcut';

    /**
     * 获取所有操作动作.
     */
    public static function getAllActions(): array
    {
        return [
            self::CREATE_PROJECT,
            self::UPDATE_PROJECT,
            self::DELETE_PROJECT,
            self::FORK_PROJECT,
            self::CREATE_TOPIC,
            self::UPDATE_TOPIC,
            self::DELETE_TOPIC,
            self::RENAME_TOPIC,
            self::UPLOAD_FILE,
            self::DELETE_FILE,
            self::RENAME_FILE,
            self::MOVE_FILE,
            self::SAVE_FILE_CONTENT,
            self::DELETE_DIRECTORY,
            self::BATCH_MOVE_FILE,
            self::BATCH_DELETE_FILE,
            self::UPDATE_PROJECT_MEMBERS,
            self::SET_PROJECT_SHORTCUT,
            self::CANCEL_PROJECT_SHORTCUT,
        ];
    }

    /**
     * 验证操作动作是否有效.
     */
    public static function isValidAction(string $action): bool
    {
        return in_array($action, self::getAllActions(), true);
    }
}
