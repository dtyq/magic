<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use Hyperf\HttpServer\Contract\RequestInterface;

class ConvertFilesRequestDTO
{
    /**
     * 文件ID列表.
     */
    public array $file_ids = [];

    /**
     * 项目ID.
     */
    public string $project_id = '';

    /**
     * 是否调试模式.
     */
    public bool $is_debug = false;

    /**
     * 转换类型: pdf, ppt, image.
     */
    public string $convert_type = '';

    /**
     * 其他选项.
     */
    public array $options = [];

    /**
     * 从请求创建DTO实例.
     */
    public static function fromRequest(RequestInterface $request): self
    {
        $data = $request->all();
        $dto = new self();

        $dto->file_ids = (array) ($data['file_ids'] ?? []);
        $dto->project_id = (string) ($data['project_id'] ?? '');
        $dto->is_debug = (bool) ($data['is_debug'] ?? false);
        $dto->convert_type = (string) ($data['convert_type'] ?? '');
        $dto->options = (array) ($data['options'] ?? []);

        return $dto;
    }
}
