<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ImageGenerate\ValueObject;

enum ImageGenerateSourceEnum: string
{
    // 超级麦吉
    case SUPER_MAGIC = 'super_magic';

    // agent
    case AGENT = 'agent';

    // 工具
    case TOOL = 'tool';

    // 流程节点
    case FLOW_NODE = 'flow_node';

    // API
    case API = 'api';
    case NONE = 'none';
}
