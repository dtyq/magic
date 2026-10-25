<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Project\Repository\Persistence;

use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Repository\Persistence\ProjectMemberRepository;
use Hyperf\Database\ConnectionInterface;
use Hyperf\Database\Query\Builder;
use Hyperf\Database\Query\Grammars\MySqlGrammar;
use Hyperf\Database\Query\Processors\Processor;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;

/**
 * @internal
 */
final class ProjectMemberParticipatedQueryTest extends TestCase
{
    public function testParticipatedProjectFilterUsesProjectModeExclusions(): void
    {
        $connection = $this->createMock(ConnectionInterface::class);
        $query = (new Builder($connection, new MySqlGrammar(), new Processor()))
            ->from('magic_super_agent_project as p');

        $repository = (new ReflectionClass(ProjectMemberRepository::class))
            ->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(ProjectMemberRepository::class, 'applyProjectListBaseFilters');
        $method->invoke($repository, $query, null, false);

        $sql = $query->toSql();

        self::assertStringContainsString('`p`.`project_mode` not in', $sql);
        self::assertContains(ProjectMode::MICRO_APP->value, ProjectMode::getQueryFilterModes());
        // 研究项目只经特殊项目接口访问，不能出现在项目列表和最近列表里。
        self::assertContains(ProjectMode::PERSONA_RESEARCH->value, ProjectMode::getQueryFilterModes());
        self::assertNotContains(ProjectMode::PERSONA_RESEARCH->value, ProjectMode::getRecentListSpecialModes());
        self::assertStringNotContainsString('magic_super_agent_micro_apps', $sql);
    }
}
