<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor\Tests\Unit;

use Dtyq\CodeExecutor\Language;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @coversNothing
 */
class LanguageTest extends TestCase
{
    public function testLanguageValues(): void
    {
        $this->assertSame('php', Language::PHP->value);
        $this->assertSame('python', Language::PYTHON->value);
    }

    public function testLanguageCases(): void
    {
        $this->assertCount(2, Language::cases());
        $this->assertContains(Language::PHP, Language::cases());
        $this->assertContains(Language::PYTHON, Language::cases());
    }
}
