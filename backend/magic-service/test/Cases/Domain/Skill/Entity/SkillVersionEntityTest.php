<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Skill\Entity;

use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishTargetValue;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use RuntimeException;

/**
 * @internal
 */
class SkillVersionEntityTest extends TestCase
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

    public function testSetPublishTargetValueCastsArrayToValueObject(): void
    {
        $entity = new SkillVersionEntity();
        $entity->setPublishTargetValue([
            'user_ids' => ['user-1', 'user-1', 'user-2'],
            'department_ids' => ['dept-1'],
        ]);

        $value = $entity->getPublishTargetValue();
        $this->assertInstanceOf(PublishTargetValue::class, $value);
        $this->assertSame(['user-1', 'user-2'], $value->getUserIds());
        $this->assertSame(['dept-1'], $value->getDepartmentIds());
    }

    public function testToArraySerializesPublishTargetValueAsArray(): void
    {
        $entity = new SkillVersionEntity();
        $entity->setCode('skill-code');
        $entity->setOrganizationCode('org-code');
        $entity->setCreatorId('user-1');
        $entity->setPackageName('package-name');
        $entity->setVersion('1.0.0');
        $entity->setNameI18n(['zh_CN' => '测试技能']);
        $entity->setFileKey('file-key');
        $entity->setSourceType('LOCAL_UPLOAD');
        $entity->setPublishTargetValue([
            'user_ids' => ['user-1'],
            'department_ids' => ['dept-1'],
        ]);

        $this->assertSame([
            'user_ids' => ['user-1'],
            'department_ids' => ['dept-1'],
        ], $entity->toArray()['publish_target_value']);
    }
}
