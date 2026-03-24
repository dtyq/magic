<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Skill\Entity\ValueObject;

use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishTargetValue;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use RuntimeException;

/**
 * @internal
 */
class PublishTargetValueTest extends TestCase
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

    public function testNormalizeIdsAndSerializeToArray(): void
    {
        $value = new PublishTargetValue([
            'user_ids' => [' user-1 ', '', 'user-1', 'user-2'],
            'department_ids' => ['dept-1', ' dept-2 ', 'dept-1'],
        ]);

        $this->assertSame(['user-1', 'user-2'], $value->getUserIds());
        $this->assertSame(['dept-1', 'dept-2'], $value->getDepartmentIds());
        $this->assertTrue($value->hasTargets());
        $this->assertFalse($value->isEmpty());
        $this->assertTrue($value->containsUserId('user-1'));
        $this->assertSame([
            'user_ids' => ['user-1', 'user-2'],
            'department_ids' => ['dept-1', 'dept-2'],
        ], $value->toArray());
    }

    public function testEmptyValueReportsNoTargets(): void
    {
        $value = new PublishTargetValue([
            'user_ids' => ['', ' '],
            'department_ids' => [],
        ]);

        $this->assertSame([], $value->getUserIds());
        $this->assertSame([], $value->getDepartmentIds());
        $this->assertFalse($value->hasTargets());
        $this->assertTrue($value->isEmpty());
        $this->assertFalse($value->containsUserId('user-1'));
    }

    public function testFromArraySupportsNull(): void
    {
        $this->assertNull(PublishTargetValue::fromArray(null));
    }
}
