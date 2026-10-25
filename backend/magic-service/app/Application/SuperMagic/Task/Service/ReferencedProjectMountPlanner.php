<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Service;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;
use RuntimeException;

/**
 * Extract unique cross-project mount targets from mentions that differ
 * from the current project.
 *
 * Collaboration mentions (@project / file / directory) and validated
 * micro-app mentions share the same project mount.
 */
final class ReferencedProjectMountPlanner
{
    private const COLLABORATION_TYPES = [
        MentionType::PROJECT->value,
        MentionType::PROJECT_FILE->value,
        MentionType::PROJECT_DIRECTORY->value,
    ];

    /**
     * @param array<int, mixed> $mentions
     * @return list<ReferencedProjectMount>
     */
    public function plan(array $mentions, int $currentProjectId): array
    {
        $mountsByProjectId = [];

        foreach ($mentions as $mention) {
            if (! is_array($mention)) {
                continue;
            }

            if (($mention['type'] ?? '') === MentionType::MICRO_APP->value) {
                $this->assertResolvedMicroApp($mention);
            }
            $mount = $this->toMount($mention, $currentProjectId);
            if ($mount === null) {
                continue;
            }

            $existing = $mountsByProjectId[$mount->projectId] ?? null;
            if ($existing === null || $this->shouldReplace($existing, $mount)) {
                $mountsByProjectId[$mount->projectId] = $mount;
            }
        }

        return array_values($mountsByProjectId);
    }

    /**
     * @param array<string, mixed> $mention
     */
    private function toMount(array $mention, int $currentProjectId): ?ReferencedProjectMount
    {
        $type = (string) ($mention['type'] ?? '');
        $accessKind = $this->resolveAccessKind($type, $mention);
        if ($accessKind === null) {
            return null;
        }

        $projectIdRaw = $mention['project_id'] ?? null;
        if ((! is_string($projectIdRaw) && ! is_int($projectIdRaw)) || ! preg_match('/^[1-9][0-9]*$/D', (string) $projectIdRaw)) {
            return null;
        }
        $projectId = (string) $projectIdRaw;
        if ((string) (int) $projectId !== $projectId || $projectId === (string) $currentProjectId) {
            return null;
        }

        $appId = trim((string) ($mention['app_id'] ?? ''));
        // Do not mount @micro_app from leftover project_id after enrich fails.
        if ($accessKind === ReferencedProjectAccessKind::PublishedShare && $appId === '') {
            return null;
        }

        return new ReferencedProjectMount(
            projectId: $projectId,
            accessKind: $accessKind,
            sourceType: $type,
            appId: $appId !== '' ? $appId : null,
        );
    }

    /**
     * @param array<string, mixed> $mention
     */
    private function resolveAccessKind(string $type, array $mention): ?ReferencedProjectAccessKind
    {
        if ($type === MentionType::MICRO_APP->value) {
            return ReferencedProjectAccessKind::tryFrom((string) ($mention['access_kind'] ?? ''));
        }
        if (in_array($type, self::COLLABORATION_TYPES, true)) {
            return ReferencedProjectAccessKind::Collaboration;
        }

        return null;
    }

    private function assertResolvedMicroApp(array $mention): void
    {
        foreach (['app_id', 'project_id'] as $key) {
            $value = $mention[$key] ?? null;
            if ((! is_int($value) && ! is_string($value))
                || ! preg_match('/^[1-9][0-9]*$/D', (string) $value)
                || (string) (int) $value !== (string) $value) {
                throw new RuntimeException('Cannot reference micro-app: access unavailable');
            }
        }
        if (! is_string($mention['access_kind'] ?? null)
            || ReferencedProjectAccessKind::tryFrom($mention['access_kind']) === null) {
            throw new RuntimeException('Cannot reference micro-app: access unavailable');
        }
    }

    private function shouldReplace(ReferencedProjectMount $existing, ReferencedProjectMount $candidate): bool
    {
        return $existing->accessKind === ReferencedProjectAccessKind::PublishedShare
            && $candidate->accessKind === ReferencedProjectAccessKind::Collaboration;
    }
}
