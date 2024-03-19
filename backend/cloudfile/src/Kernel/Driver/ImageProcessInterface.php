<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Driver;

use Dtyq\CloudFile\Kernel\Struct\ImageProcessOptions;

/**
 * 图片处理接口，用于抹平不同云存储服务商的差异
 * 每个服务商（OSS、TOS 等）实现此接口，将统一的 ImageProcessOptions 转换为服务商特定的处理字符串.
 */
interface ImageProcessInterface
{
    /**
     * 从统一选项构建服务商特定的处理字符串.
     *
     * @param ImageProcessOptions $options 统一的图片处理选项
     * @return string 服务商特定的处理字符串
     */
    public function buildProcessString(ImageProcessOptions $options): string;

    /**
     * 获取服务商使用的参数名称.
     *
     * @return string 参数名称（例如：'x-oss-process', 'x-tos-process'）
     */
    public function getParameterName(): string;
}
