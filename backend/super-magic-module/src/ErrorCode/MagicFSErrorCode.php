<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * MagicFS 错误码范围: 51300-51399 (100个可用码).
 */
enum MagicFSErrorCode: int
{
    #[ErrorMessage('magicfs.file_not_found')]
    case FILE_NOT_FOUND = 51300;

    #[ErrorMessage('magicfs.parent_directory_not_found')]
    case PARENT_DIRECTORY_NOT_FOUND = 51301;

    #[ErrorMessage('magicfs.file_already_exists')]
    case FILE_ALREADY_EXISTS = 51302;

    #[ErrorMessage('magicfs.directory_not_empty')]
    case DIRECTORY_NOT_EMPTY = 51303;

    #[ErrorMessage('magicfs.invalid_file_name')]
    case INVALID_FILE_NAME = 51304;

    #[ErrorMessage('magicfs.operation_failed')]
    case OPERATION_FAILED = 51305;

    #[ErrorMessage('magicfs.name_is_required')]
    case NAME_IS_REQUIRED = 51306;

    #[ErrorMessage('magicfs.parent_not_directory')]
    case PARENT_NOT_DIRECTORY = 51307;

    #[ErrorMessage('magicfs.file_already_exists_in_target')]
    case FILE_ALREADY_EXISTS_IN_TARGET = 51308;

    #[ErrorMessage('magicfs.invalid_file_key')]
    case INVALID_FILE_KEY = 51309;

    #[ErrorMessage('magicfs.no_updates_provided')]
    case NO_UPDATES_PROVIDED = 51310;
}
