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
        return match ($this->value) {
            // 文件操作
            'list_dir', 'read_files', 'write_file', 'edit_file', 'multi_edit_file',
            'delete_file', 'file_search', 'grep_search' => BuiltinToolCategory::FileOperations,

            // 搜索提取
            'web_search', 'image_search', 'read_webpages_as_markdown', 'use_browser',
            'download_from_urls', 'download_from_markdown' => BuiltinToolCategory::SearchExtraction,

            // 内容处理
            'visual_understanding', 'convert_pdf', 'voice_understanding', 'summarize',
            'text_to_image', 'image_edit', 'create_slide', 'create_slide_project',
            'create_dashboard_project', 'update_dashboard_template', 'backup_dashboard_template', 'finish_dashboard_task' => BuiltinToolCategory::ContentProcessing,

            // 系统执行
            'shell_exec', 'python_execute' => BuiltinToolCategory::SystemExecution,

            // AI协作
            'create_memory', 'update_memory', 'delete_memory', 'finish_task' => BuiltinToolCategory::AIAssistance,
        };
    }

    /**
     * 获取工具类型.
     */
    public static function getToolType(): SuperMagicAgentToolType
    {
        return SuperMagicAgentToolType::BuiltIn;
    }
}
