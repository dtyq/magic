<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor\Tests\Unit;

use Dtyq\CodeExecutor\AbstractExecutor;
use Dtyq\CodeExecutor\ExecutionRequest;
use Dtyq\CodeExecutor\ExecutionResult;
use Dtyq\CodeExecutor\Language;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @coversNothing
 */
class AbstractExecutorTest extends TestCase
{
    private $executor;

    protected function setUp(): void
    {
        $this->executor = new class extends AbstractExecutor {
            private array $supportedLanguages = [];

            public function __construct()
            {
                $this->supportedLanguages = [Language::PHP, Language::PYTHON];
            }

            public function doExecute(ExecutionRequest $request): ExecutionResult
            {
                return new ExecutionResult();
            }

            public function getSupportedLanguages(): array
            {
                return $this->supportedLanguages;
            }

            public function initialize(): void
            {
                // Implementation for test
            }

            public function isLanguageSupportedPublic(Language $language): bool
            {
                return $this->isLanguageSupported($language);
            }
        };
    }

    public function testIsLanguageSupported(): void
    {
        $this->assertTrue($this->executor->isLanguageSupportedPublic(Language::PHP));
        $this->assertTrue($this->executor->isLanguageSupportedPublic(Language::PYTHON));
    }
}
