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
    case ReadWebpagesAsMarkdown = 'read_webpages_as_markdown';
    case DownloadFromUrls = 'download_from_urls';
    case DownloadFromMarkdown = 'download_from_markdown';

    // 内容处理 (ContentProcessing)
    case VisualUnderstanding = 'visual_understanding';
    case GenerateImage = 'generate_image';
    case ConvertPdf = 'convert_pdf';

    // 系统执行 (SystemExecution)
    case ShellExec = 'shell_exec';
    case PythonExecute = 'python_execute';

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
            self::WebSearch, self::ReadWebpagesAsMarkdown,
            self::DownloadFromUrls, self::DownloadFromMarkdown => BuiltinToolCategory::SearchExtraction,

            // 内容处理
            self::VisualUnderstanding, self::GenerateImage, self::ConvertPdf => BuiltinToolCategory::ContentProcessing,

            // 系统执行
            self::ShellExec, self::PythonExecute => BuiltinToolCategory::SystemExecution,
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
            // 基础文件增删查改 + 目录查看
            self::ListDir,
            self::ReadFiles,
            self::WriteFile,
            self::EditFile,
            self::MultiEditFile,
            self::DeleteFile,
            self::FileSearch,
            self::GrepSearch,
            // 互联网搜索和阅读
            self::WebSearch,
            self::ReadWebpagesAsMarkdown,
            // 视觉理解
            self::VisualUnderstanding,
            // 命令行执行
            self::ShellExec,
        ];
    }

    public static function isValidTool(string $tool): bool
    {
        return (bool) self::tryFrom($tool);
    }

    /**
     * 判断工具是否为必须工具.
     */
    public function isRequired(): bool
    {
        return in_array($this, self::getRequiredTools(), true);
    }
}
