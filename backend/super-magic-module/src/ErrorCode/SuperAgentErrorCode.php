<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * 错误码范围:51000-51299 (300个可用码)
 * 分配方案：
 * - Workspace: 51000-51049 (50个)
 * - Topic: 51050-51099 (50个)
 * - Task: 51100-51149 (50个)
 * - File: 51150-51199 (50个)
 * - Reserved1: 51200-51249 (50个)
 * - Reserved2: 51250-51299 (50个).
 */
enum SuperAgentErrorCode: int
{
    // Workspace related error codes (51000-51049)
    #[ErrorMessage('workspace.parameter_check_failure')]
    case VALIDATE_FAILED = 51000;

    #[ErrorMessage('workspace.access_denied')]
    case WORKSPACE_ACCESS_DENIED = 51001;

    // Topic related error codes (51050-51099)
    #[ErrorMessage('topic.topic_not_found')]
    case TOPIC_NOT_FOUND = 51050;

    #[ErrorMessage('topic.create_topic_failed')]
    case CREATE_TOPIC_FAILED = 51051;

    #[ErrorMessage('topic.concurrent_operation_failed')]
    case TOPIC_LOCK_FAILED = 51052;

    #[ErrorMessage('topic.topic_access_denied')]
    case TOPIC_ACCESS_DENIED = 51053;

    #[ErrorMessage('topic.topic_not_running')]
    case TOPIC_NOT_RUNNING = 51054;

    // Task related error codes (51100-51149)
    #[ErrorMessage('task.not_found')]
    case TASK_NOT_FOUND = 51100;

    #[ErrorMessage('task.work_dir_not_found')]
    case WORK_DIR_NOT_FOUND = 51101;

    #[ErrorMessage('task.create_workspace_version_failed')]
    case CREATE_WORKSPACE_VERSION_FAILED = 51102;

    // File related error codes (51150-51199)
    #[ErrorMessage('file.permission_denied')]
    case FILE_PERMISSION_DENIED = 51150;

    #[ErrorMessage('file.content_too_large')]
    case FILE_CONTENT_TOO_LARGE = 51151;

    #[ErrorMessage('file.concurrent_modification')]
    case FILE_CONCURRENT_MODIFICATION = 51152;

    #[ErrorMessage('file.save_rate_limit')]
    case FILE_SAVE_RATE_LIMIT = 51153;

    #[ErrorMessage('file.upload_failed')]
    case FILE_UPLOAD_FAILED = 51154;

    #[ErrorMessage('file.batch_file_ids_required')]
    case BATCH_FILE_IDS_REQUIRED = 51155;

    #[ErrorMessage('file.batch_file_ids_invalid')]
    case BATCH_FILE_IDS_INVALID = 51156;

    #[ErrorMessage('file.batch_too_many_files')]
    case BATCH_TOO_MANY_FILES = 51157;

    #[ErrorMessage('file.batch_no_valid_files')]
    case BATCH_NO_VALID_FILES = 51158;

    #[ErrorMessage('file.batch_access_denied')]
    case BATCH_ACCESS_DENIED = 51159;

    #[ErrorMessage('file.batch_publish_failed')]
    case BATCH_PUBLISH_FAILED = 51160;

    #[ErrorMessage('file.batch_topic_id_invalid')]
    case BATCH_TOPIC_ID_INVALID = 51161;

    #[ErrorMessage('file.batch_file_ids_or_topic_id_required')]
    case BATCH_FILE_IDS_OR_TOPIC_ID_REQUIRED = 51162;

    #[ErrorMessage('file.sandbox_not_ready')]
    case SANDBOX_NOT_READY = 51163;

    #[ErrorMessage('file.sandbox_save_failed')]
    case SANDBOX_SAVE_FAILED = 51164;

    #[ErrorMessage('file.multiple_projects_not_allowed')]
    case MULTIPLE_PROJECTS_NOT_ALLOWED = 51165;

    #[ErrorMessage('file.file_not_found')]
    case FILE_NOT_FOUND = 51166;

    #[ErrorMessage('file.delete_failed')]
    case FILE_DELETE_FAILED = 51167;

    #[ErrorMessage('file.file_exist')]
    case FILE_EXIST = 51168;

    #[ErrorMessage('file.file_rename_failed')]
    case FILE_RENAME_FAILED = 51170;

    #[ErrorMessage('file.file_move_failed')]
    case FILE_MOVE_FAILED = 51171;

    #[ErrorMessage('file.illegal_file_name')]
    case FILE_ILLEGAL_NAME = 51172;

    #[ErrorMessage('file.file_create_failed')]
    case FILE_CREATE_FAILED = 51173;

    #[ErrorMessage('file.file_save_failed')]
    case FILE_SAVE_FAILED = 51174;

    #[ErrorMessage('file.illegal_file_key')]
    case FILE_ILLEGAL_KEY = 51175;

    #[ErrorMessage('file.convert_failed')]
    case FILE_CONVERT_FAILED = 51176;

    #[ErrorMessage('file.move_operation_busy')]
    case FILE_OPERATION_BUSY = 51177;

    // Project related error codes (51200-51249)
    #[ErrorMessage('project.project_not_found')]
    case PROJECT_NOT_FOUND = 51200;

    #[ErrorMessage('project.project_name_already_exists')]
    case PROJECT_NAME_ALREADY_EXISTS = 51201;

    #[ErrorMessage('project.project_access_denied')]
    case PROJECT_ACCESS_DENIED = 51202;

    #[ErrorMessage('project.create_project_failed')]
    case CREATE_PROJECT_FAILED = 51203;

    #[ErrorMessage('project.update_project_failed')]
    case UPDATE_PROJECT_FAILED = 51204;

    #[ErrorMessage('project.delete_project_failed')]
    case DELETE_PROJECT_FAILED = 51205;

    #[ErrorMessage('workspace.workspace_not_found')]
    case WORKSPACE_NOT_FOUND = 51206;

    #[ErrorMessage('project.project_id_required')]
    case BATCH_PROJECT_ID_REQUIRED = 51207;

    #[ErrorMessage('project.fork_already_running')]
    case PROJECT_FORK_ALREADY_RUNNING = 51208;

    #[ErrorMessage('project.fork_not_found')]
    case PROJECT_FORK_NOT_FOUND = 51209;

    #[ErrorMessage('project.fork_access_denied')]
    case PROJECT_FORK_ACCESS_DENIED = 51210;

    #[ErrorMessage('project.department_not_found')]
    case DEPARTMENT_NOT_FOUND = 51211;

    #[ErrorMessage('project.invalid_member_type')]
    case INVALID_MEMBER_TYPE = 51212;

    #[ErrorMessage('project.update_members_failed')]
    case UPDATE_MEMBERS_FAILED = 51213;

    #[ErrorMessage('project.member_validation_failed')]
    case MEMBER_VALIDATION_FAILED = 51214;

    // Reserved2 area - keeping original error codes that were outside planned ranges
    #[ErrorMessage('task.create_workspace_version_failed')]
    case CREATE_WORKSPACE_VERSION_FAILED_LEGACY = 51252;

    #[ErrorMessage('topic.concurrent_operation_failed')]
    case TOPIC_LOCK_FAILED_LEGACY = 51253;

    #[ErrorMessage('task.access_token.not_found')]
    case ACCESS_TOKEN_NOT_FOUND = 51254;
}
