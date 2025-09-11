<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

use function Hyperf\Translation\trans;

enum BuiltinTool: string
{
    // 文件操作 (FileOperations)
    case ListDir = 'list_dir';
    case ReadFiles = 'read_files';
    case WriteFile = 'write_file';
    case EditFile = 'edit_file';
    case MultiEditFile = 'multi_edit_file';
    case DeleteFile = 'delete_file';
    case FileSearch = 'file_search';
    case GrepSearch = 'grep_search';

    // 搜索提取 (SearchExtraction)
    case WebSearch = 'web_search';
    case ImageSearch = 'image_search';
    case ReadWebpagesAsMarkdown = 'read_webpages_as_markdown';
    case UseBrowser = 'use_browser';
    case DownloadFromUrls = 'download_from_urls';
    case DownloadFromMarkdown = 'download_from_markdown';

    // 内容处理 (ContentProcessing)
    case VisualUnderstanding = 'visual_understanding';
    case ConvertPdf = 'convert_pdf';
    case VoiceUnderstanding = 'voice_understanding';
    case Summarize = 'summarize';
    case TextToImage = 'text_to_image';
    case ImageEdit = 'image_edit';
    case CreateSlide = 'create_slide';
    case CreateSlideProject = 'create_slide_project';
    case CreateDashboardProject = 'create_dashboard_project';
    case UpdateDashboardTemplate = 'update_dashboard_template';
    case BackupDashboardTemplate = 'backup_dashboard_template';
    case FinishDashboardTask = 'finish_dashboard_task';

    // 系统执行 (SystemExecution)
    case ShellExec = 'shell_exec';
    case PythonExecute = 'python_execute';

    // AI协作 (AIAssistance)
    case CreateMemory = 'create_memory';
    case UpdateMemory = 'update_memory';
    case DeleteMemory = 'delete_memory';
    case FinishTask = 'finish_task';
    case CompactChatHistory = 'compact_chat_history';

    /**
     * 获取工具的用户友好名称.
     */
    public function getToolName(): string
    {
        return trans("builtin_tools.names.{$this->value}");
    }

    /**
     * 获取工具的用户友好描述.
     */
    public function getToolDescription(): string
    {
        return trans("builtin_tools.descriptions.{$this->value}");
    }

    /**
     * 获取工具的图标.
     */
    public function getToolIcon(): string
    {
        // 暂时返回空字符串，等待前端提供图标内容
        return '';
    }

    /**
     * 获取工具的分类.
     */
    public function getToolCategory(): BuiltinToolCategory
    {
        return match ($this) {
            // 文件操作
            self::ListDir, self::ReadFiles, self::WriteFile, self::EditFile, self::MultiEditFile,
            self::DeleteFile, self::FileSearch, self::GrepSearch => BuiltinToolCategory::FileOperations,

            // 搜索提取
            self::WebSearch, self::ImageSearch, self::ReadWebpagesAsMarkdown, self::UseBrowser,
            self::DownloadFromUrls, self::DownloadFromMarkdown => BuiltinToolCategory::SearchExtraction,

            // 内容处理
            self::VisualUnderstanding, self::ConvertPdf, self::VoiceUnderstanding, self::Summarize,
            self::TextToImage, self::ImageEdit, self::CreateSlide, self::CreateSlideProject,
            self::CreateDashboardProject, self::UpdateDashboardTemplate, self::BackupDashboardTemplate, self::FinishDashboardTask => BuiltinToolCategory::ContentProcessing,

            // 系统执行
            self::ShellExec, self::PythonExecute => BuiltinToolCategory::SystemExecution,

            // AI协作
            self::CreateMemory, self::UpdateMemory, self::DeleteMemory, self::FinishTask, self::CompactChatHistory => BuiltinToolCategory::AIAssistance,
        };
    }

    /**
     * 获取工具类型.
     */
    public static function getToolType(): SuperMagicAgentToolType
    {
        return SuperMagicAgentToolType::BuiltIn;
    }

    /**
     * 获取所有必须的工具.
     * @return array<BuiltinTool>
     */
    public static function getRequiredTools(): array
    {
        return [
            // 文件操作
            self::ListDir,
            self::ReadFiles,
            self::GrepSearch,
            self::WriteFile,
            self::EditFile,
            self::MultiEditFile,
            self::DeleteFile,
            // 搜索提取
            self::WebSearch,
            self::ReadWebpagesAsMarkdown,
            self::DownloadFromUrls,
            // 内容处理
            self::VisualUnderstanding,
            // 系统执行
            self::ShellExec,
            // AI协作
            self::CreateMemory,
            self::UpdateMemory,
            self::DeleteMemory,
            self::FinishTask,
            self::CompactChatHistory,
        ];
    }

    /**
     * 判断工具是否为必须工具.
     */
    public function isRequired(): bool
    {
        return in_array($this, self::getRequiredTools(), true);
    }
}
