<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Provider\Entity\ValueObject;

use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Di\Container;
use Hyperf\Di\Definition\DefinitionSource;
use Hyperf\Support\Filesystem\Filesystem;
use Hyperf\Translation\FileLoader;
use Hyperf\Translation\Translator;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class AiAbilityCodeTest extends TestCase
{
    public function testAbilityNameAndDescriptionComeFromTranslations(): void
    {
        $translator = new Translator(
            new FileLoader(new Filesystem(), dirname(__DIR__, 6) . '/storage/languages'),
            'zh_CN'
        );
        $translator->setFallback('en_US');
        $container = new Container(new DefinitionSource([]));
        $container->set(TranslatorInterface::class, $translator);
        ApplicationContext::setContainer($container);

        $this->assertSame(
            '向量化嵌入模型',
            AiAbilityCode::KnowledgeBaseEmbeddingModel->getName('zh_CN')
        );
        $this->assertSame(
            'Vector Embedding Model',
            AiAbilityCode::KnowledgeBaseEmbeddingModel->getName('en_US')
        );
        $this->assertSame(
            '本能力面向全平台各类向量化业务场景，统一提供内容向量化、向量重建及向量检索能力，作为标准化嵌入模型供各模块调用',
            AiAbilityCode::KnowledgeBaseEmbeddingModel->getDescription('zh_CN')
        );
        $this->assertSame(
            'This capability serves vectorization scenarios across the entire platform, providing standardized content vectorization, vector reconstruction, and vector retrieval capabilities as an embedding model for all modules.',
            AiAbilityCode::KnowledgeBaseEmbeddingModel->getDescription('en_US')
        );
        $this->assertSame(
            'Vector Embedding Model',
            AiAbilityCode::KnowledgeBaseEmbeddingModel->getName('ms_MY')
        );
    }
}
