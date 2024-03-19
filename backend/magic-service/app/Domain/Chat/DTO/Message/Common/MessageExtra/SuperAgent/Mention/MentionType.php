<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention;

enum MentionType: string
{
    case PROJECT_DIRECTORY = 'project_directory';
    case PROJECT_FILE = 'project_file';

    /**
     * 本次消息中临时上传的文件，后续会统一到 project_file 中.
     */
    case UPLOAD_FILE = 'upload_file';

    case AGENT = 'agent';
    case MCP = 'mcp';
    case TOOL = 'tool';
    case SKILL = 'skill';

    /**
     * 设计标记，用于标注图片中的对象或区域.
     */
    case DESIGN_MARKER = 'design_marker';
}
