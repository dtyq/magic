<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Task\Service;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;

/**
 * 将跨项目 mention 中的相对路径转换为容器内的绝对路径。
 *
 * - type=project_file / type=project_directory：把相对 file_path/directory_path 前缀挂载根
 * - type=project / type=micro_app：整项目挂载，直接注入 project_path = {mountBasePath}/{project_id}
 * - 同项目（project_id === currentProjectId）跳过，走 agent 自身 workspace
 * - file_path/directory_path 已为绝对路径（以 / 开头）跳过，防双前缀
 * - project_id 缺失或为空时跳过.
 */
final class CrossProjectMentionPathTranslator
{
    /**
     * @param array<int, mixed> $mentions
     * @param null|int $currentProjectId 当前 task 所属项目 ID（同项目 mention 不做路径转换）
     * @param string $mountBasePath 跨项目引用挂载的容器内基础路径（来自 env AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH）
     * @return array<int, mixed> 处理后的 mentions 数组
     */
    public function translate(array $mentions, ?int $currentProjectId, string $mountBasePath): array
    {
        if ($mountBasePath === '' || $mentions === []) {
            return $mentions;
        }

        $base = rtrim($mountBasePath, '/');

        foreach ($mentions as $i => $mention) {
            if (! is_array($mention)) {
                continue;
            }
            $type = $mention['type'] ?? null;

            // 统一派发：跨项目挂载各自要写入的路径字段
            $pathKey = match ($type) {
                MentionType::PROJECT->value, MentionType::MICRO_APP->value => 'project_path',
                MentionType::PROJECT_FILE->value => 'file_path',
                MentionType::PROJECT_DIRECTORY->value => 'directory_path',
                default => null,
            };
            if ($pathKey === null) {
                continue;
            }

            // 共享 project_id 校验：缺失或同项目则跳过，走 agent 自身 workspace
            $pidRaw = $mention['project_id'] ?? null;
            if ((! is_string($pidRaw) && ! is_int($pidRaw)) || ! preg_match('/^[1-9][0-9]*$/D', (string) $pidRaw)) {
                continue;
            }
            $pidStr = (string) $pidRaw;
            if ((string) (int) $pidStr !== $pidStr) {
                continue;
            }
            if ($currentProjectId !== null && (string) $currentProjectId === $pidStr) {
                continue;
            }

            $mountRoot = $base . '/' . $pidStr;

            if ($type === MentionType::PROJECT->value || $type === MentionType::MICRO_APP->value) {
                // 整项目挂载：直接使用挂载根
                $mentions[$i][$pathKey] = $mountRoot;
                continue;
            }

            // 文件/目录：拼接相对路径；为空或已是绝对路径则跳过（防双前缀）
            $relativePath = (string) ($mention[$pathKey] ?? '');
            if ($relativePath === '' || str_starts_with($relativePath, '/') || str_starts_with($relativePath, '~')) {
                continue;
            }
            $mentions[$i][$pathKey] = $mountRoot . '/' . ltrim($relativePath, '/');
        }

        return $mentions;
    }
}
