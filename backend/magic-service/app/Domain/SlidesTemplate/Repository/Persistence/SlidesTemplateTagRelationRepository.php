<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Repository\Persistence;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Factory\SlidesTemplateTagFactory;
use App\Domain\SlidesTemplate\Repository\Facade\SlidesTemplateTagRelationRepositoryInterface;
use App\Domain\SlidesTemplate\Repository\Persistence\Model\SlidesTemplateTagModel;
use App\Domain\SlidesTemplate\Repository\Persistence\Model\SlidesTemplateTagRelationModel;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

class SlidesTemplateTagRelationRepository extends AbstractRepository implements SlidesTemplateTagRelationRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    protected string $filterOrganizationCodeAlias = 'magic_slides_template_tags.organization_code';

    public function syncTemplateTags(SlidesTemplateDataIsolation $dataIsolation, int $templateId, array $tagIds, string $createdUid): void
    {
        $this->deleteByTemplateId($dataIsolation, $templateId);

        $tagIds = array_values(array_unique(array_map('intval', $tagIds)));
        $tagIds = array_values(array_filter($tagIds, static fn (int $tagId): bool => $tagId > 0));
        if ($tagIds === []) {
            return;
        }

        $now = date('Y-m-d H:i:s');
        $rows = [];
        foreach ($tagIds as $tagId) {
            $rows[] = [
                'id' => IdGenerator::getSnowId(),
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'template_id' => $templateId,
                'tag_id' => $tagId,
                'created_uid' => $createdUid,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        SlidesTemplateTagRelationModel::query()->insert($rows);
    }

    public function deleteByTemplateId(SlidesTemplateDataIsolation $dataIsolation, int $templateId): void
    {
        $organizationCodes = array_values(array_filter($dataIsolation->getOrganizationCodes()));
        $builder = SlidesTemplateTagRelationModel::query()->where('template_id', $templateId);
        if ($organizationCodes !== []) {
            $builder->whereIn('organization_code', $organizationCodes);
        }

        $builder->delete();
    }

    public function findTagsByTemplateIds(
        SlidesTemplateDataIsolation $dataIsolation,
        array $templateIds,
        ?int $tagStatus = null,
        array $tagCodes = [],
    ): array {
        $templateIds = array_values(array_unique(array_map('intval', $templateIds)));
        $templateIds = array_values(array_filter($templateIds, static fn (int $templateId): bool => $templateId > 0));
        if ($templateIds === []) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, SlidesTemplateTagModel::query());
        $builder->join('magic_slides_template_tag_relations AS r', 'r.tag_id', '=', 'magic_slides_template_tags.id')
            ->whereIn('r.template_id', $templateIds)
            ->select('magic_slides_template_tags.*')
            ->addSelect('r.template_id AS relation_template_id')
            ->orderBy('magic_slides_template_tags.sort', 'desc')
            ->orderBy('magic_slides_template_tags.id', 'desc');

        if ($tagStatus !== null) {
            $builder->where('magic_slides_template_tags.status', $tagStatus);
        }
        if ($tagCodes !== []) {
            $builder->whereIn('magic_slides_template_tags.code', $tagCodes);
        }

        $result = [];
        foreach ($builder->get() as $model) {
            if (! $model instanceof SlidesTemplateTagModel) {
                continue;
            }
            $templateId = (int) $model->relation_template_id;
            $result[$templateId][] = SlidesTemplateTagFactory::modelToEntity($model);
        }

        return $result;
    }
}
