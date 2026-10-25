<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Skill;

use App\Application\SuperMagic\Skill\Service\SkillAppService;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\SuperMagic\Skill\Entity\SkillEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillQuery;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Domain\SuperMagic\Skill\Service\SkillDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillVersionDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Context\RequestContext;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;

/** @internal */
final class SkillAppServiceCreatedListTest extends TestCase
{
    public function testCreatedListReportsOwnerRoleForEverySkill(): void
    {
        $skill = new SkillEntity();
        $skill->setCode('SKILL-1');
        $skill->setCreatorId('');
        $domain = $this->createMock(SkillDomainService::class);
        $domain->method('queries')->willReturn(['list' => [$skill], 'total' => 1]);
        $versions = $this->createMock(SkillVersionDomainService::class);
        $versions->method('findCurrentPublishedVersionsByCodes')->willReturn([]);

        $service = $this->getMockBuilder(SkillAppService::class)->disableOriginalConstructor()
            ->onlyMethods(['createSkillDataIsolation', 'updateSkillLogoUrl'])->getMock();
        $service->method('createSkillDataIsolation')->willReturn($this->createMock(SkillDataIsolation::class));
        foreach (['skillDomainService' => $domain, 'skillVersionDomainService' => $versions] as $name => $value) {
            (new ReflectionProperty(SkillAppService::class, $name))->setValue($service, $value);
        }
        $context = $this->createMock(RequestContext::class);

        $result = $service->queriesCreated($context, new SkillQuery([]), new Page(1, 10));

        self::assertSame(Operation::Owner, $result['skill_operations']['SKILL-1']);
    }
}
