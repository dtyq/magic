<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Agent\Entity;

use App\Domain\SuperMagic\Agent\Entity\AgentVersionEntity;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class AgentVersionEntityTest extends TestCase
{
    public function testVersionDescriptionUsesCurrentLanguageThenDefault(): void
    {
        $entity = new AgentVersionEntity();
        $entity->setVersionDescriptionI18n([
            'zh_CN' => '中文描述',
            'default' => '默认描述',
        ]);

        $this->assertSame('中文描述', $entity->getI18nVersionDescription('zh_CN'));
        $this->assertSame('默认描述', $entity->getI18nVersionDescription('en_US'));

        $entity->setVersionDescriptionI18n([]);
        $this->assertSame('', $entity->getI18nVersionDescription('zh_CN'));
    }
}
