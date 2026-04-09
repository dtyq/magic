<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject;

use function Hyperf\Translation\trans;

enum BuiltinSkill: string
{
    case AnalyzingDataDashboard = 'analyzing-data-dashboard';
    case AnalyzingDataHtmlReport = 'analyzing-data-html-report';
    case ImChannels = 'im-channels';
    case CreatingSlides = 'creating-slides';
    case CrewCreator = 'crew-creator';
    case DataQa = 'data-qa';
    case DeepResearch = 'deep-research';
    case CanvasDesigner = 'canvas-designer';
    case SkillCreator = 'skill-creator';

    public function getSkillName(): string
    {
        return trans("builtin_skills.names.{$this->value}");
    }

    public function getNameI18n(): array
    {
        $zhName = $this->getLocalizedValue('zh_CN', 'names');
        $enName = $this->getLocalizedValue('en_US', 'names');

        return [
            'zh_CN' => $zhName,
            'en_US' => $enName,
            'default' => $enName,
        ];
    }

    public function getSkillDescription(): string
    {
        return trans("builtin_skills.descriptions.{$this->value}");
    }

    public function getDescriptionI18n(): array
    {
        $zhDescription = $this->getLocalizedValue('zh_CN', 'descriptions');
        $enDescription = $this->getLocalizedValue('en_US', 'descriptions');

        return [
            'zh_CN' => $zhDescription,
            'en_US' => $enDescription,
            'default' => $enDescription,
        ];
    }

    public function getSkillIcon(): string
    {
        return '';
    }

    public function getPackageName(): string
    {
        return $this->value;
    }

    public function getSourceI18n(): array
    {
        return [
            'zh_CN' => '官方内置',
            'en_US' => 'Official Built-in',
            'default' => 'Official Built-in',
        ];
    }

    /**
     * @return array<BuiltinSkill>
     */
    public static function getAllBuiltinSkills(): array
    {
        return self::cases();
    }

    /**
     * @return array<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    private function getLocalizedValue(string $locale, string $group): string
    {
        return trans("builtin_skills.{$group}.{$this->value}", [], $locale);
    }
}
