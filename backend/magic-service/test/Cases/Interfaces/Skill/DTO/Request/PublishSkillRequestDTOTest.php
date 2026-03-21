<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Interfaces\Skill\DTO\Request;

use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishTargetType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishTargetValue;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\PublishSkillRequestDTO;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use RuntimeException;

/**
 * @internal
 */
class PublishSkillRequestDTOTest extends TestCase
{
    public static function setUpBeforeClass(): void
    {
        if (! ApplicationContext::hasContainer()) {
            ApplicationContext::setContainer(new class implements ContainerInterface {
                public function get(string $id)
                {
                    return match ($id) {
                        PhpSerializerPacker::class => new PhpSerializerPacker(),
                        default => throw new RuntimeException('Unsupported service: ' . $id),
                    };
                }

                public function has(string $id): bool
                {
                    return $id === PhpSerializerPacker::class;
                }
            });
        }
    }

    public function testToPublishTargetValueNormalizesMembersAndDepartments(): void
    {
        $dto = new PublishSkillRequestDTO();
        $dto->publishTargetValue = [
            'user_ids' => [' user-1 ', '', 'user-1', 'user-2'],
            'department_ids' => ['dept-1', ' dept-2 ', 'dept-1'],
        ];

        $value = $dto->toPublishTargetValue();

        $this->assertInstanceOf(PublishTargetValue::class, $value);
        $this->assertSame(['user-1', 'user-2'], $dto->getPublishTargetUserIds());
        $this->assertSame(['dept-1', 'dept-2'], $dto->getPublishTargetDepartmentIds());
        $this->assertSame(['user-1', 'user-2'], $value->getUserIds());
        $this->assertSame(['dept-1', 'dept-2'], $value->getDepartmentIds());
    }

    public function testToPublishTargetValueReturnsNullWhenPayloadMissing(): void
    {
        $dto = new PublishSkillRequestDTO();

        $this->assertNull($dto->toPublishTargetValue());
        $this->assertSame([], $dto->getPublishTargetUserIds());
        $this->assertSame([], $dto->getPublishTargetDepartmentIds());
    }

    public function testGetPublishTargetTypeFromPayload(): void
    {
        $dto = new PublishSkillRequestDTO();
        $dto->publishTargetType = 'MEMBER';

        $this->assertSame('MEMBER', $dto->getPublishTargetType());
    }

    public function testGetPublishTargetTypeDefaultsToPrivate(): void
    {
        $dto = new PublishSkillRequestDTO();

        $this->assertSame(PublishTargetType::PRIVATE->value, $dto->getPublishTargetType());
    }
}
