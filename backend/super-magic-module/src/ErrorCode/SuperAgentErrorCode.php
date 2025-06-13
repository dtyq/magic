<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * 错误码范围:51000-51300.
 */
enum SuperAgentErrorCode: int
{
    #[ErrorMessage('workspace.parameter_check_failure')]
    case VALIDATE_FAILED = 51000;

    #[ErrorMessage('workspace.access_denied')]
    case WORKSPACE_ACCESS_DENIED = 51001;

    #[ErrorMessage('topic.topic_not_found')]
    case TOPIC_NOT_FOUND = 51100;

    #[ErrorMessage('topic.create_topic_failed')]
    case CREATE_TOPIC_FAILED = 51101;

    #[ErrorMessage('task.not_found')]
    case TASK_NOT_FOUND = 51200;

    #[ErrorMessage('task.work_dir_not_found')]
    case WORK_DIR_NOT_FOUND = 51201;

    // File save related error codes
    #[ErrorMessage('file.permission_denied')]
    case FILE_PERMISSION_DENIED = 51102;

    #[ErrorMessage('file.content_too_large')]
    case FILE_CONTENT_TOO_LARGE = 51103;

    #[ErrorMessage('file.concurrent_modification')]
    case FILE_CONCURRENT_MODIFICATION = 51104;

    #[ErrorMessage('file.save_rate_limit')]
    case FILE_SAVE_RATE_LIMIT = 51105;

    #[ErrorMessage('file.upload_failed')]
    case FILE_UPLOAD_FAILED = 51106;

    // File batch download related error codes
    #[ErrorMessage('file.batch_file_ids_required')]
    case BATCH_FILE_IDS_REQUIRED = 51107;

    #[ErrorMessage('file.batch_file_ids_invalid')]
    case BATCH_FILE_IDS_INVALID = 51108;

    #[ErrorMessage('file.batch_too_many_files')]
    case BATCH_TOO_MANY_FILES = 51109;

    #[ErrorMessage('file.batch_no_valid_files')]
    case BATCH_NO_VALID_FILES = 51110;

    #[ErrorMessage('file.batch_access_denied')]
    case BATCH_ACCESS_DENIED = 51111;

    #[ErrorMessage('file.batch_publish_failed')]
    case BATCH_PUBLISH_FAILED = 51112;
}
