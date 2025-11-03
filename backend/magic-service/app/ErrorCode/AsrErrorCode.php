<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

enum AsrErrorCode: int
{
    #[ErrorMessage(message: 'common.error')]
    case Error = 43000;

    #[ErrorMessage(message: 'common.request_timeout')]
    case RequestTimeout = 43122;

    #[ErrorMessage(message: 'asr.config_error.invalid_config')]
    case InvalidConfig = 43006;

    #[ErrorMessage(message: 'asr.config_error.invalid_magic_id')]
    case InvalidMagicId = 43007;

    #[ErrorMessage(message: 'asr.driver_error.driver_not_found')]
    case DriverNotFound = 43008;

    #[ErrorMessage(message: 'asr.audio_error.invalid_audio')]
    case InvalidAudioFormat = 43012;

    #[ErrorMessage(message: 'asr.recognition_error.recognize_error')]
    case RecognitionError = 43022;

    #[ErrorMessage(message: 'asr.connection_error.websocket_connection_failed')]
    case WebSocketConnectionFailed = 43100;

    #[ErrorMessage(message: 'asr.file_error.file_not_found')]
    case FileNotFound = 43101;

    #[ErrorMessage(message: 'asr.file_error.file_open_failed')]
    case FileOpenFailed = 43102;

    #[ErrorMessage(message: 'asr.file_error.file_read_failed')]
    case FileReadFailed = 43103;

    #[ErrorMessage(message: 'asr.invalid_audio_url')]
    case InvalidAudioUrl = 43104;

    #[ErrorMessage(message: 'asr.audio_url_required')]
    case AudioUrlRequired = 43105;

    // 任务状态错误 (43200-43299)
    #[ErrorMessage(message: 'asr.task_error.task_already_completed')]
    case TaskAlreadyCompleted = 43200;

    #[ErrorMessage(message: 'asr.task_error.task_already_canceled')]
    case TaskAlreadyCanceled = 43201;

    #[ErrorMessage(message: 'asr.task_error.task_is_summarizing')]
    case TaskIsSummarizing = 43202;

    #[ErrorMessage(message: 'asr.task_error.task_auto_stopped_by_timeout')]
    case TaskAutoStoppedByTimeout = 43203;

    #[ErrorMessage(message: 'asr.task_error.invalid_status_transition')]
    case InvalidStatusTransition = 43204;

    #[ErrorMessage(message: 'asr.task_error.recording_already_stopped')]
    case RecordingAlreadyStopped = 43205;

    #[ErrorMessage(message: 'asr.task_error.upload_not_allowed')]
    case UploadNotAllowed = 43206;

    #[ErrorMessage(message: 'asr.task_error.status_report_not_allowed')]
    case StatusReportNotAllowed = 43207;

    #[ErrorMessage(message: 'asr.task_error.summary_not_allowed')]
    case SummaryNotAllowed = 43208;

    #[ErrorMessage(message: 'asr.exception.task_not_exist_get_upload_token')]
    case TaskNotExist = 43209;

    #[ErrorMessage(message: 'asr.api.validation.upload_audio_first')]
    case UploadAudioFirst = 43210;

    #[ErrorMessage(message: 'asr.exception.task_not_belong_to_user')]
    case TaskNotBelongToUser = 43211;

    // 沙箱错误 (43300-43399)
    #[ErrorMessage(message: 'asr.exception.sandbox_task_creation_failed')]
    case SandboxTaskCreationFailed = 43300;

    #[ErrorMessage(message: 'asr.exception.sandbox_id_not_exist')]
    case SandboxIdNotExist = 43301;

    #[ErrorMessage(message: 'asr.exception.sandbox_cancel_failed')]
    case SandboxCancelFailed = 43302;

    #[ErrorMessage(message: 'asr.exception.sandbox_merge_failed')]
    case SandboxMergeFailed = 43303;

    #[ErrorMessage(message: 'asr.exception.sandbox_merge_timeout')]
    case SandboxMergeTimeout = 43304;

    #[ErrorMessage(message: 'asr.exception.sandbox_start_retry_exceeded')]
    case SandboxStartRetryExceeded = 43305;

    // 目录相关错误 (43400-43499)
    #[ErrorMessage(message: 'asr.exception.create_hidden_directory_failed_project')]
    case CreateHiddenDirectoryFailedProject = 43400;

    #[ErrorMessage(message: 'asr.exception.create_hidden_directory_failed_error')]
    case CreateHiddenDirectoryFailedError = 43401;

    #[ErrorMessage(message: 'asr.exception.create_states_directory_failed_project')]
    case CreateStatesDirectoryFailedProject = 43402;

    #[ErrorMessage(message: 'asr.exception.create_states_directory_failed_error')]
    case CreateStatesDirectoryFailedError = 43403;

    #[ErrorMessage(message: 'asr.exception.create_display_directory_failed_project')]
    case CreateDisplayDirectoryFailedProject = 43404;

    #[ErrorMessage(message: 'asr.exception.create_display_directory_failed_error')]
    case CreateDisplayDirectoryFailedError = 43405;

    #[ErrorMessage(message: 'asr.exception.workspace_directory_empty')]
    case WorkspaceDirectoryEmpty = 43406;

    #[ErrorMessage(message: 'asr.exception.directory_rename_failed')]
    case DirectoryRenameFailed = 43407;

    #[ErrorMessage(message: 'asr.exception.hidden_directory_not_found')]
    case HiddenDirectoryNotFound = 43408;

    // 文件相关错误 (43500-43599)
    #[ErrorMessage(message: 'asr.exception.file_not_exist')]
    case FileNotExist = 43500;

    #[ErrorMessage(message: 'asr.exception.file_not_belong_to_project')]
    case FileNotBelongToProject = 43501;

    #[ErrorMessage(message: 'asr.exception.audio_file_id_empty')]
    case AudioFileIdEmpty = 43502;

    #[ErrorMessage(message: 'asr.exception.create_audio_file_failed')]
    case CreateAudioFileFailed = 43503;

    #[ErrorMessage(message: 'asr.exception.update_note_file_failed')]
    case UpdateNoteFileFailed = 43504;

    #[ErrorMessage(message: 'asr.exception.batch_update_children_failed')]
    case BatchUpdateChildrenFailed = 43505;

    #[ErrorMessage(message: 'asr.exception.create_preset_file_failed')]
    case CreatePresetFileFailed = 43506;

    // 项目/权限相关错误 (43600-43699)
    #[ErrorMessage(message: 'asr.api.validation.project_access_denied_organization')]
    case ProjectAccessDeniedOrganization = 43600;

    #[ErrorMessage(message: 'asr.api.validation.project_access_denied_user')]
    case ProjectAccessDeniedUser = 43601;

    #[ErrorMessage(message: 'asr.api.validation.project_not_found')]
    case ProjectNotFound = 43602;

    #[ErrorMessage(message: 'asr.api.validation.project_access_validation_failed')]
    case ProjectAccessValidationFailed = 43603;

    // 话题/用户相关错误 (43700-43799)
    #[ErrorMessage(message: 'asr.exception.topic_not_exist')]
    case TopicNotExist = 43700;

    #[ErrorMessage(message: 'asr.exception.topic_not_exist_simple')]
    case TopicNotExistSimple = 43701;

    #[ErrorMessage(message: 'asr.exception.user_not_exist')]
    case UserNotExist = 43702;

    // 锁相关错误 (43800-43899)
    #[ErrorMessage(message: 'asr.api.lock.system_busy')]
    case SystemBusy = 43800;
}
