<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Constant;

enum DefaultFileType: int
{
    case DEFAULT = 0; // 默认的文件
    case NOT_DEFAULT = 1; // 组织上传的
}
