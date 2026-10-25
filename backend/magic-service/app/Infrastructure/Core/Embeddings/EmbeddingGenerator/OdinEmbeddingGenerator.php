<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Embeddings\EmbeddingGenerator;

use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use Hyperf\Odin\Contract\Model\EmbeddingInterface;
use Hyperf\Odin\Model\Embedding;
use Psr\SimpleCache\CacheInterface;

readonly class OdinEmbeddingGenerator implements EmbeddingGeneratorInterface
{
    public function __construct(private CacheInterface $cache)
    {
    }

    public function getDefaultModel(BaseDataIsolation $dataIsolation): EmbeddingInterface
    {
        return di(ModelGatewayMapper::class)->getEmbeddingModelProxy(
            $dataIsolation,
            EmbeddingGenerator::getVectorDefaultModel(),
        );
    }

    public function embedText(
        EmbeddingInterface $embeddingModel,
        string $text,
        array $options = [],
    ): array {
        $businessParams = $options['business_params'] ?? [];
        unset($options['business_params']);
        // 对嵌入做缓存，减少消耗
        $cacheKey = 'embedding:' . md5($embeddingModel->getModelName() . $embeddingModel->getVectorSize() . $text . serialize($options));
        if ($this->cache->has($cacheKey)) {
            $data = $this->cache->get($cacheKey);
        } else {
            $response = $embeddingModel->embeddings($text, businessParams: $businessParams);
            // 从响应中提取嵌入向量
            $embeddings = [];
            foreach ($response->getData() as $embedding) {
                $embeddings[] = $embedding->getEmbedding();
            }

            $embedding = new Embedding($embeddings[0] ?? []);
            $vector = $embedding->getEmbeddings();
            if ($vector === []) {
                // Do not cache an empty response; transient provider failures must be retried.
                return [];
            }

            $data = [
                'text' => $text,
                'embeddings' => $vector,
                'class' => get_class($embeddingModel),
                'options' => $options,
            ];
            $this->cache->set($cacheKey, $data, 3600 * 24 * 3);
        }
        return $data['embeddings'] ?? [];
    }
}
