<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Task\Service;

use App\Domain\SuperMagic\Task\Service\CrossProjectMentionPathTranslator;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class CrossProjectMentionPathTranslatorTest extends TestCase
{
    public function testTranslateWritesProjectPathForMicroApp(): void
    {
        $translator = new CrossProjectMentionPathTranslator();

        $result = $translator->translate(
            [
                [
                    'type' => 'micro_app',
                    'app_id' => '3001',
                    'project_id' => '4001',
                ],
            ],
            1001,
            '/mnt/agfs-vol/agfs/magicfs/referenced-projects',
        );

        self::assertSame(
            '/mnt/agfs-vol/agfs/magicfs/referenced-projects/4001',
            $result[0]['project_path'],
        );
    }

    public function testTranslateSkipsMicroAppWithoutProjectId(): void
    {
        $translator = new CrossProjectMentionPathTranslator();
        $mention = ['type' => 'micro_app', 'app_id' => '3001'];

        $result = $translator->translate([$mention], 1001, '/mnt/agfs-vol/agfs/magicfs/referenced-projects');

        self::assertArrayNotHasKey('project_path', $result[0]);
    }

    public function testTranslateWritesProjectPathForProjectMention(): void
    {
        $translator = new CrossProjectMentionPathTranslator();

        $result = $translator->translate(
            [
                [
                    'type' => 'project',
                    'project_id' => '4002',
                ],
            ],
            1001,
            '/mnt/agfs-vol/agfs/magicfs/referenced-projects',
        );

        self::assertSame(
            '/mnt/agfs-vol/agfs/magicfs/referenced-projects/4002',
            $result[0]['project_path'],
        );
    }

    public function testTranslateSkipsMicroAppOnCurrentProject(): void
    {
        $translator = new CrossProjectMentionPathTranslator();

        $result = $translator->translate(
            [
                [
                    'type' => 'micro_app',
                    'app_id' => '3001',
                    'project_id' => '1001',
                ],
            ],
            1001,
            '/mnt/agfs-vol/agfs/magicfs/referenced-projects',
        );

        self::assertArrayNotHasKey('project_path', $result[0]);
    }

    public function testTranslateSkipsInvalidProjectIds(): void
    {
        $translator = new CrossProjectMentionPathTranslator();
        foreach ([[], true, 0, -1, 1.5, '04001', ' 4001 ', '../4001', '9223372036854775808'] as $projectId) {
            foreach (['project', 'micro_app', 'project_file', 'project_directory'] as $type) {
                $mention = ['type' => $type, 'project_id' => $projectId, 'file_path' => 'report.md'];
                self::assertSame([$mention], $translator->translate([$mention], 1001, '/mounts'));
            }
        }
    }

    public function testTranslatePreservesUserPathsAndMountsProjectRelativePaths(): void
    {
        $translator = new CrossProjectMentionPathTranslator();
        $mentions = [
            ['type' => 'project_file', 'project_id' => 4001, 'file_path' => '~/report.md'],
            ['type' => 'project_directory', 'project_id' => 4001, 'directory_path' => '~/.magic'],
            ['type' => 'user_file', 'project_id' => 4001, 'file_path' => 'report.md'],
            ['type' => 'project_file', 'project_id' => 4001, 'file_path' => 'report.md'],
        ];
        $expected = $mentions;
        $expected[3]['file_path'] = '/mounts/4001/report.md';

        self::assertSame($expected, $translator->translate($mentions, 1001, '/mounts'));
    }
}
