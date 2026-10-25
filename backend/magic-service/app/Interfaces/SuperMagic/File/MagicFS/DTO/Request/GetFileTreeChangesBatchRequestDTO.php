<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\MagicFS\DTO\Request;

use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * 批量拉取变更：一次请求服务一个进程的全部挂载点，把降级路径的成本从 O(挂载点) 降到 O(1)。
 *
 * 每个 root 的归一化都交给 GetFileTreeChangesRequestDTO::fromArray()，
 * 逐 root 又复用单 root 的服务路径，所以批量接口不会长出第二套游标语义。
 */
class GetFileTreeChangesBatchRequestDTO
{
    /**
     * 与请求里的 roots 一一对应（含 root_file_id 为空的项），
     * 这样出参 results 的下标才能和入参对上。
     *
     * @var array<int, array{root_file_id:string, since_revision:int, limit:int}>
     */
    public array $roots = [];

    public static function fromRequest(RequestInterface $request): self
    {
        $data = $request->all();
        $dto = new self();

        $roots = $data['roots'] ?? [];
        if (! is_array($roots)) {
            return $dto;
        }

        foreach ($roots as $root) {
            // 形状不对的项也保留占位：出参与入参一一对应，调用方才能按 root 定位结果。
            $root = is_array($root) ? $root : [];
            $single = GetFileTreeChangesRequestDTO::fromArray($root);
            $dto->roots[] = [
                'root_file_id' => (string) ($root['root_file_id'] ?? ''),
                'since_revision' => $single->since_revision,
                'limit' => $single->limit,
            ];
        }

        return $dto;
    }
}
