/* global MagicPluginKit, MagicPromptLocale, registerMagicCanvasPlugin */

const DESIGN_TYPE = {
	/* 灵感设计 */
	INSPIRATION: "inspiration",
	/* 爆款延伸 */
	BESTSELLER: "bestseller",
	/* 系列设计 */
	SERIES: "series",
}
const GARMENT_CATEGORY = {
	/* 羽绒服 */
	DOWN_JACKET: "downJacket",
	/* 连衣裙 */
	DRESS: "dress",
	/* 半裙 */
	SKIRT: "skirt",
	/* 西装 */
	SUIT: "suit",
	/* 皮衣 */
	LEATHER_JACKET: "leatherJacket",
	/* 皮毛一体 */
	SHEARLING: "shearling",
	/* 牛仔外套 */
	DENIM_JACKET: "denimJacket",
	/* 防晒服 */
	SUN_PROTECTION: "sunProtection",
	/* 工装 */
	UTILITY_WEAR: "utilityWear",
	/* 冲锋衣 */
	HARD_SHELL: "hardshell",
	/* 新中式 */
	NEW_CHINESE: "newChinese",
	/* 小香风 */
	TWEED_STYLE: "tweedStyle",
	/* 针织衫 */
	KNITWEAR: "knitwear",
	/* 衬衫 */
	SHIRT: "shirt",
	/* T恤/卫衣 */
	SWEATSHIRT_TEE: "sweatshirtTee",
	/* 裤子 */
	PANTS: "pants",
	/* 大衣 */
	COAT: "coat",
	/* 派克服 */
	PARKA: "parka",
	/* 皮草 */
	FUR: "fur",
	/* 风衣 */
	TRENCH_COAT: "trenchCoat",
	/* 更多 */
	MORE: "more",
}
const DESIGN_TYPE_DEFINITIONS = [
	{
		value: DESIGN_TYPE.INSPIRATION,
		labelKey: "designType.inspiration",
		labelFallback: "灵感设计",
		descriptionKey: "designType.inspiration.desc",
		descriptionFallback:
			"上传参考廓形的原型图与灵感图，一键生成保留原型廓形、并应用灵感图设计细节的新款。",
	},
	{
		value: DESIGN_TYPE.BESTSELLER,
		labelKey: "designType.bestseller",
		labelFallback: "爆款延伸",
		descriptionKey: "designType.bestseller.desc",
		descriptionFallback:
			"基于爆款快速扩展同品类新款，在不改变版型/面料的情况下改变设计点，无需手绘即可预览成衣效果。",
	},
	{
		value: DESIGN_TYPE.SERIES,
		labelKey: "designType.series",
		labelFallback: "系列设计",
		descriptionKey: "designType.series.desc",
		descriptionFallback:
			"围绕主题生成系列新款，保持核心设计语言，通过调整廓形、袖长、长度等结构衍生不同场景单品。",
	},
]

const PRIMARY_CATEGORY_DEFINITIONS = [
	{
		value: GARMENT_CATEGORY.DOWN_JACKET,
		labelKey: "category.downJacket",
		labelFallback: "羽绒服",
		promptText: { zh: "羽绒服", en: "down jacket" },
	},
	{
		value: GARMENT_CATEGORY.COAT,
		labelKey: "category.coat",
		labelFallback: "大衣",
		promptText: { zh: "大衣", en: "coat" },
	},
	{
		value: GARMENT_CATEGORY.PARKA,
		labelKey: "category.parka",
		labelFallback: "派克服",
		promptText: { zh: "派克服", en: "parka" },
	},
	{
		value: GARMENT_CATEGORY.FUR,
		labelKey: "category.fur",
		labelFallback: "皮草",
		promptText: { zh: "皮草", en: "fur coat" },
	},
	{
		value: GARMENT_CATEGORY.TRENCH_COAT,
		labelKey: "category.trenchCoat",
		labelFallback: "风衣",
		promptText: { zh: "风衣", en: "trench coat" },
	},
	{
		value: GARMENT_CATEGORY.MORE,
		labelKey: "category.more",
		labelFallback: "更多",
		promptText: { zh: "服装", en: "garment" },
	},
]

const MORE_CATEGORY_DEFINITIONS = [
	{
		value: GARMENT_CATEGORY.DRESS,
		labelKey: "category.dress",
		labelFallback: "连衣裙",
		promptText: { zh: "连衣裙", en: "dress" },
	},
	{
		value: GARMENT_CATEGORY.SKIRT,
		labelKey: "category.skirt",
		labelFallback: "半裙",
		promptText: { zh: "半裙", en: "skirt" },
	},
	{
		value: GARMENT_CATEGORY.SUIT,
		labelKey: "category.suit",
		labelFallback: "西装",
		promptText: { zh: "西装", en: "suit / blazer" },
	},
	{
		value: GARMENT_CATEGORY.LEATHER_JACKET,
		labelKey: "category.leatherJacket",
		labelFallback: "皮衣",
		promptText: { zh: "皮衣", en: "leather jacket" },
	},
	{
		value: GARMENT_CATEGORY.SHEARLING,
		labelKey: "category.shearling",
		labelFallback: "皮毛一体",
		promptText: { zh: "皮毛一体", en: "shearling coat" },
	},
	{
		value: GARMENT_CATEGORY.DENIM_JACKET,
		labelKey: "category.denimJacket",
		labelFallback: "牛仔外套",
		promptText: { zh: "牛仔外套", en: "denim jacket" },
	},
	{
		value: GARMENT_CATEGORY.SUN_PROTECTION,
		labelKey: "category.sunProtection",
		labelFallback: "防晒服",
		promptText: { zh: "防晒服", en: "sun protection wear" },
	},
	{
		value: GARMENT_CATEGORY.UTILITY_WEAR,
		labelKey: "category.utilityWear",
		labelFallback: "工装",
		promptText: { zh: "工装", en: "utility wear" },
	},
	{
		value: GARMENT_CATEGORY.HARD_SHELL,
		labelKey: "category.hardshell",
		labelFallback: "冲锋衣",
		promptText: { zh: "冲锋衣", en: "hardshell jacket" },
	},
	{
		value: GARMENT_CATEGORY.NEW_CHINESE,
		labelKey: "category.newChinese",
		labelFallback: "新中式",
		promptText: { zh: "新中式", en: "new Chinese style" },
	},
	{
		value: GARMENT_CATEGORY.TWEED_STYLE,
		labelKey: "category.tweedStyle",
		labelFallback: "小香风",
		promptText: { zh: "小香风", en: "tweed style" },
	},
	{
		value: GARMENT_CATEGORY.KNITWEAR,
		labelKey: "category.knitwear",
		labelFallback: "针织衫",
		promptText: { zh: "针织衫", en: "knitwear" },
	},
	{
		value: GARMENT_CATEGORY.SHIRT,
		labelKey: "category.shirt",
		labelFallback: "衬衫",
		promptText: { zh: "衬衫", en: "shirt" },
	},
	{
		value: GARMENT_CATEGORY.SWEATSHIRT_TEE,
		labelKey: "category.sweatshirtTee",
		labelFallback: "T恤/卫衣",
		promptText: { zh: "T恤/卫衣", en: "T-shirt / sweatshirt" },
	},
	{
		value: GARMENT_CATEGORY.PANTS,
		labelKey: "category.pants",
		labelFallback: "裤子",
		promptText: { zh: "裤子", en: "pants" },
	},
]

const STYLE_TYPE_DEFINITIONS = [
	{
		value: "versatileBasic",
		labelKey: "styleType.versatileBasic",
		labelFallback: "百搭基础风",
		promptText: { zh: "百搭基础风", en: "versatile basic style" },
	},
	{
		value: "commuterOl",
		labelKey: "styleType.commuterOl",
		labelFallback: "通勤/OL风",
		promptText: { zh: "通勤/OL风", en: "commuter / OL style" },
	},
	{
		value: "casualNatural",
		labelKey: "styleType.casualNatural",
		labelFallback: "休闲自然风",
		promptText: { zh: "休闲自然风", en: "casual natural style" },
	},
	{
		value: "minimalist",
		labelKey: "styleType.minimalist",
		labelFallback: "极简风",
		promptText: { zh: "极简风", en: "minimalist style" },
	},
	{
		value: "euroAmerican",
		labelKey: "styleType.euroAmerican",
		labelFallback: "欧美风",
		promptText: { zh: "欧美风", en: "European and American style" },
	},
	{
		value: "ladylike",
		labelKey: "styleType.ladylike",
		labelFallback: "淑女风",
		promptText: { zh: "淑女风", en: "ladylike style" },
	},
	{
		value: "pastoral",
		labelKey: "styleType.pastoral",
		labelFallback: "田园风",
		promptText: { zh: "田园风", en: "pastoral style" },
	},
	{
		value: "collegiate",
		labelKey: "styleType.collegiate",
		labelFallback: "学院风",
		promptText: { zh: "学院风", en: "collegiate style" },
	},
	{
		value: "korean",
		labelKey: "styleType.korean",
		labelFallback: "韩版风",
		promptText: { zh: "韩版风", en: "Korean style" },
	},
	{
		value: "genderNeutral",
		labelKey: "styleType.genderNeutral",
		labelFallback: "中性风",
		promptText: { zh: "中性风", en: "gender-neutral style" },
	},
	{
		value: "newChinese",
		labelKey: "styleType.newChinese",
		labelFallback: "新中式",
		promptText: { zh: "新中式", en: "new Chinese style" },
	},
	{
		value: "streetHipHop",
		labelKey: "styleType.streetHipHop",
		labelFallback: "嘻哈风",
		promptText: { zh: "嘻哈风", en: "street / hip-hop style" },
	},
]

function createInitialState() {
	return {
		prototypeImages: [],
		designType: DESIGN_TYPE.INSPIRATION,
		inspirationImage: null,
		garmentCategory: GARMENT_CATEGORY.DOWN_JACKET,
		garmentCategoryMore: "",
		styleType: "",
		designPointDescription: "",
		seriesTheme: "",
	}
}

function getMaxReferenceImages(state, helpers) {
	return helpers.getSelectedModel(state)?.image_size_config?.max_reference_images ?? 5
}

function getPrototypeImages(state) {
	return Array.isArray(state.prototypeImages) ? state.prototypeImages : []
}

function getReferenceImages(state, prototypeImage = getPrototypeImages(state)[0]) {
	if (state.designType === DESIGN_TYPE.INSPIRATION) {
		return [prototypeImage, state.inspirationImage].filter(Boolean)
	}
	return prototypeImage ? [prototypeImage] : []
}

function buildDesignTypeOptions(t) {
	return DESIGN_TYPE_DEFINITIONS.map((item) => ({
		value: item.value,
		label: t(item.labelKey, item.labelFallback),
		description: t(item.descriptionKey, item.descriptionFallback),
	}))
}

function buildPrimaryCategoryOptions(t) {
	return PRIMARY_CATEGORY_DEFINITIONS.map((item) => ({
		value: item.value,
		label: t(item.labelKey, item.labelFallback),
	}))
}

function buildMoreCategoryOptions(t) {
	return MORE_CATEGORY_DEFINITIONS.map((item) => ({
		value: item.value,
		label: t(item.labelKey, item.labelFallback),
	}))
}

function buildStyleTypeOptions(t) {
	return STYLE_TYPE_DEFINITIONS.map((item) => ({
		value: item.value,
		label: t(item.labelKey, item.labelFallback),
	}))
}

function buildCurrentTextBlock(currentText) {
	const normalizedCurrentText = String(currentText ?? "").trim()
	if (!normalizedCurrentText) return "用户当前未填写。"
	return normalizedCurrentText
}

function getStyleTypeDefinition(styleType) {
	if (!styleType) return null
	return STYLE_TYPE_DEFINITIONS.find((item) => item.value === styleType) ?? null
}

function getGarmentCategoryLabel(state) {
	const categoryDefinition = getGarmentCategoryDefinition(state)
	return categoryDefinition?.labelFallback ?? "未选择"
}

function getStyleTypeLabel(styleType) {
	return getStyleTypeDefinition(styleType)?.labelFallback ?? "未选择"
}

function buildDesignPointCompletionUserPrompt({ state, currentText }) {
	return [
		"任务目标：为款式设计插件的“设计点描述”输入框生成或补全一段提示词。",
		`当前输入：${buildCurrentTextBlock(currentText)}`,
		`当前服装品类：${getGarmentCategoryLabel(state)}。`,
		`当前风格类型：${getStyleTypeLabel(state.styleType)}。`,
		"参考图角色：原型图用于理解当前爆款的版型、面料、结构、工艺和可改款部位。",
		"补全方向：可补充领型、门襟、口袋、绗线、拼接、袖口、下摆、辅料、局部装饰等单一或少量明确设计点。",
		"业务限制：不要改变整体廓形比例、核心版型结构和面料属性；不要输出完整生成任务说明，只输出适合填入“设计点描述”的短提示词。",
	].join("\n")
}

function buildSeriesThemeCompletionUserPrompt({ currentText }) {
	return [
		"任务目标：为款式设计插件的“系列主题”输入框生成或补全一段提示词。",
		`当前输入：${buildCurrentTextBlock(currentText)}`,
		"参考图角色：原型图用于理解品牌感、核心设计 DNA、色彩体系、面料质感和工艺语言。",
		"补全方向：可补充系列主题、目标场景、风格气质、色彩氛围、工艺语言和单品延展方向。",
		"业务限制：主题要适合成衣系列开发，保持具体、可执行、便于生成多款同系列单品；只输出适合填入“系列主题”的短提示词。",
	].join("\n")
}

function getGarmentCategoryDefinition(state) {
	if (state.designType !== DESIGN_TYPE.BESTSELLER) return null
	if (state.garmentCategory === GARMENT_CATEGORY.MORE) {
		return (
			MORE_CATEGORY_DEFINITIONS.find((item) => item.value === state.garmentCategoryMore) ??
			null
		)
	}
	return PRIMARY_CATEGORY_DEFINITIONS.find((item) => item.value === state.garmentCategory) ?? null
}

function hasValidBestsellerCategory(state) {
	if (state.designType !== DESIGN_TYPE.BESTSELLER) return true
	if (state.garmentCategory === GARMENT_CATEGORY.MORE) {
		return MORE_CATEGORY_DEFINITIONS.some((item) => item.value === state.garmentCategoryMore)
	}
	return PRIMARY_CATEGORY_DEFINITIONS.some(
		(item) => item.value === state.garmentCategory && item.value !== GARMENT_CATEGORY.MORE,
	)
}

function isGenerateDisabled(state) {
	if (!getPrototypeImages(state).length) return true
	if (state.designType === DESIGN_TYPE.INSPIRATION) return !state.inspirationImage
	if (state.designType === DESIGN_TYPE.BESTSELLER) return !hasValidBestsellerCategory(state)
	if (state.designType === DESIGN_TYPE.SERIES) return !state.seriesTheme.trim()
	return true
}

function buildInspirationDesignPrompt({ state, locale }) {
	const isChinese = MagicPromptLocale.isChinese(locale)
	const prototypeRef = MagicPromptLocale.getReferenceLabel(1, locale)
	const inspirationRef = MagicPromptLocale.getReferenceLabel(2, locale)

	if (isChinese) {
		return (
			`使用${prototypeRef}作为廓形锚点，使用${inspirationRef}作为灵感来源，生成一张新的成衣款式效果图。` +
			`必须严格保持${prototypeRef}的整体廓形、比例与关键结构线，不得改变版型框架。` +
			`从${inspirationRef}吸收配色、面料肌理表达、工艺细节、装饰元素与设计风格语言，并自然融合到同一廓形上。` +
			"输出需为可落地的成衣级商业展示效果，结构清晰、工艺细节可信，避免手绘草图感或结构失真。" +
			(state.genCount > 1
				? "多张生成时保持同一廓形锚点与灵感方向一致，在细节呈现或角度上做自然变化。"
				: "")
		)
	}

	return (
		`Use ${prototypeRef} as the silhouette anchor and ${inspirationRef} as the inspiration source to create a new finished-garment style image. ` +
		`Strictly preserve the overall silhouette, proportion, and key structural lines from ${prototypeRef}; do not change the pattern framework. ` +
		`Borrow color, material texture expression, craftsmanship details, trims, and decorative language from ${inspirationRef}, and integrate them naturally onto the same silhouette. ` +
		"The result should feel like a production-ready commercial garment presentation with clear structure and believable construction details, not a hand sketch or distorted pattern. " +
		(state.genCount > 1
			? "When generating multiple images, keep the same silhouette anchor and inspiration direction while varying detail presentation or angle naturally. "
			: "")
	)
}

function buildBestsellerExtensionPrompt({ state, locale }) {
	const isChinese = MagicPromptLocale.isChinese(locale)
	const prototypeRef = MagicPromptLocale.getReferenceLabel(1, locale)
	const categoryDefinition = getGarmentCategoryDefinition(state)
	const categoryText = MagicPromptLocale.pickText(categoryDefinition.promptText, locale)
	const styleDefinition = getStyleTypeDefinition(state.styleType)
	const styleText = styleDefinition
		? MagicPromptLocale.pickText(styleDefinition.promptText, locale)
		: null
	const designPointText = state.designPointDescription.trim()

	if (isChinese) {
		const styleClause = styleText ? `风格类型：${styleText}。改款方向需贴合该风格气质。` : ""
		const designPointClause = designPointText
			? `改款设计点要求：${designPointText}。请优先落实上述设计点变化，其余部位保持与原型一致。`
			: ""

		return (
			`基于${prototypeRef}中的爆款原型，在「${categoryText}」品类语境下生成改款成衣效果图。` +
			styleClause +
			designPointClause +
			`严格保持${prototypeRef}的版型与面料质感不变，不得改变整体廓形比例、核心版型结构与面料属性。` +
			(designPointText
				? "除上述指定设计点外，不得擅自改动其他结构或装饰。"
				: "仅调整可感知的设计点，例如领型、门襟、口袋、绗线、辅料、局部拼接或装饰细节，便于买手与设计师快速决策。") +
			`展示方式严格跟随${prototypeRef}：若${prototypeRef}为真人模特穿着，则输出保留真人模特穿着展示；若为平铺、挂拍、人台或静物陈列且无真人主体，则不得新增真人模特，仅展示服装本体。` +
			"每张输出图只呈现一种改款方案，聚焦单一设计点变化；禁止在同一张图内拼贴、并列或对比多种改款。" +
			"输出为成衣级商业展示效果，结构清晰、工艺细节可信，不要手绘草图或概念拼贴感。"
		)
	}

	const styleClause = styleText
		? `Style direction: ${styleText}. The restyling should align with this style mood. `
		: ""
	const designPointClause = designPointText
		? `Design-point requirements: ${designPointText}. Prioritize these changes while keeping all other areas consistent with the prototype. `
		: ""

	return (
		`Based on the bestseller prototype in ${prototypeRef}, create a restyled finished-garment image within the ${categoryText} category context. ` +
		styleClause +
		designPointClause +
		`Strictly preserve the pattern and fabric character from ${prototypeRef}; do not change the overall silhouette proportion, core pattern structure, or material identity. ` +
		(designPointText
			? "Do not alter other structures or decorations beyond the specified design points. "
			: "Only adjust visible design points such as collar, placket, pockets, quilting lines, trims, local paneling, or decorative details to support fast buyer and designer decisions. ") +
		`Strictly match the presentation mode of ${prototypeRef}. If it shows a worn look on a real human model, keep a believable on-body presentation. If it is flat-lay, hanging, mannequin, or still-life without a dominant human subject, do not add human models and focus on the garment itself. ` +
		"Each output image must present only one restyling proposal focused on a single design-point change; do not collage, align, or compare multiple restylings in one image. " +
		"Deliver a production-ready commercial garment presentation with clear structure and believable construction details, not a hand sketch or collage concept."
	)
}

function buildSeriesDesignPrompt({ state, locale }) {
	const isChinese = MagicPromptLocale.isChinese(locale)
	const prototypeRef = MagicPromptLocale.getReferenceLabel(1, locale)
	const seriesTheme = state.seriesTheme.trim()

	if (isChinese) {
		return (
			`以${prototypeRef}为核心设计 DNA，围绕「${seriesTheme}」主题生成系列新款成衣方案。` +
			`保持色彩体系、工艺语言与品牌感一致，延续${prototypeRef}的核心设计语言。` +
			"允许在廓形松紧、袖长、衣长、下摆结构等维度做适度结构变化，衍生适配不同穿搭场景的单品，但系列整体需风格统一。" +
			"输出为成衣级商业展示效果，每张为同系列中的不同单品方案，避免机械重复同一画面。" +
			(state.genCount > 1
				? `一次生成 ${state.genCount} 套同主题系列单品，各款之间保持系列关联又具备可区分性。`
				: "")
		)
	}

	return (
		`Using ${prototypeRef} as the core design DNA, generate a themed series of new finished-garment proposals around "${seriesTheme}". ` +
		`Preserve a consistent color system, craftsmanship language, and brand feeling while continuing the core design language from ${prototypeRef}. ` +
		"Allow moderate structural variation in silhouette ease, sleeve length, garment length, and hem structure to create pieces for different styling scenes, while keeping the series visually unified. " +
		"Deliver production-ready commercial garment presentations where each image is a distinct piece in the same series, not a mechanical duplicate of one frame. " +
		(state.genCount > 1
			? `Generate ${state.genCount} related series pieces in one run, each distinguishable yet clearly part of the same theme. `
			: "")
	)
}

function buildGarmentStyleDesignPrompt({ state, locale }) {
	if (state.designType === DESIGN_TYPE.INSPIRATION) {
		return buildInspirationDesignPrompt({ state, locale })
	}
	if (state.designType === DESIGN_TYPE.BESTSELLER) {
		return buildBestsellerExtensionPrompt({ state, locale })
	}
	return buildSeriesDesignPrompt({ state, locale })
}

registerMagicCanvasPlugin({
	create(ctx) {
		return {
			state: MagicPluginKit.createPanelState(ctx, createInitialState()),
		}
	},
	render(ctx, instance, root, scope) {
		const t = (key, fallback) => ctx.i18n.t(key, fallback)
		const promptLocale = MagicPromptLocale.resolveLocale(ctx)

		return ctx.panel.render(root, {
			panelClassName: "garment-style-design",
			state: instance.state,
			modelConfig: {
				autoLoad: true,
				showLoadErrors: true,
				noModelsMessage: t("error.noModels", "暂无可用 AI 模型"),
			},
			sections: [
				{
					id: "prototypeImages",
					kind: "image-grid",
					stateKey: "prototypeImages",
					title: t("section.prototypeImage", "原型图"),
					required: true,
					addLabel: "+",
					alt: t("section.prototypeImage", "原型图"),
					help: t(
						"upload.prototypeImage.help",
						"可上传多张原型图，每张原型图将分别与灵感图配对生成。",
					),
					deps: ["designType", "inspirationImage", "modelId", "modelOptions"],
					maxCount: ({ state, helpers }) => getMaxReferenceImages(state, helpers),
				},
				{
					id: "designType",
					kind: "tabs",
					stateKey: "designType",
					title: t("section.designType", "设计类型"),
					required: true,
					showDescriptionOnHover: true,
					options: buildDesignTypeOptions(t),
					panels: [
						{
							value: DESIGN_TYPE.INSPIRATION,
							sections: [
								{
									id: "inspirationImage",
									kind: "image-slot",
									stateKey: "inspirationImage",
									title: t("section.inspirationImage", "灵感图"),
									required: true,
									uploadLabel: t("upload.inspirationImage", "点击上传灵感图"),
									alt: t("section.inspirationImage", "灵感图"),
									help: t(
										"upload.inspirationImage.help",
										"上传 1 张灵感图，AI 将借鉴其配色、工艺、辅料与装饰语言，同时严格保持原型图的廓形。",
									),
									deps: ["prototypeImages", "modelId", "modelOptions"],
									beforePick: ({ state, helpers }) => {
										if (
											getReferenceImages(state).length >=
											getMaxReferenceImages(state, helpers)
										) {
											return t(
												"error.referenceLimit",
												"参考图数量已达当前模型上限",
											)
										}
										return null
									},
								},
							],
						},
						{
							value: DESIGN_TYPE.BESTSELLER,
							sections: [
								{
									id: "garmentCategory",
									kind: "option-group",
									stateKey: "garmentCategory",
									title: t("section.garmentCategory", "服装品类"),
									required: true,
									groupClassName: "gsd-category-group",
									options: buildPrimaryCategoryOptions(t),
									patchOnSelect: (value) =>
										value === GARMENT_CATEGORY.MORE
											? {
													garmentCategoryMore:
														MORE_CATEGORY_DEFINITIONS[0]?.value ?? "",
												}
											: { garmentCategoryMore: "" },
								},
								{
									id: "garmentCategoryMore",
									kind: "option-group",
									stateKey: "garmentCategoryMore",
									title: t("section.garmentCategoryMore", "更多品类"),
									required: true,
									groupClassName: "gsd-category-more-group",
									options: buildMoreCategoryOptions(t),
									deps: ["garmentCategory"],
									when: ({ state }) =>
										state.garmentCategory === GARMENT_CATEGORY.MORE,
								},
								{
									id: "styleType",
									kind: "option-group",
									stateKey: "styleType",
									title: t("section.styleType", "风格类型"),
									groupClassName: "gsd-style-type-group",
									options: buildStyleTypeOptions(t),
								},
								{
									id: "designPointDescription",
									kind: "textarea",
									stateKey: "designPointDescription",
									title: t("section.designPointDescription", "设计点描述"),
									placeholder: t(
										"placeholder.designPointDescription",
										"例如：门襟改双拉链、口袋改立体贴袋、领型改戗驳领",
									),
									aiGenerate: {
										label: t("button.aiPlaceholder", "AI 生成"),
										loadingLabel: t("button.generating", "生成中…"),
										disabled: ({ state }) => !getPrototypeImages(state).length,
										completeImagePrompt: {
											referenceImages: ({ state }) =>
												getPrototypeImages(state),
											referencesMessage: t(
												"error.extraReferences",
												"请先上传原型图",
											),
											userPrompt: ({ state }) =>
												buildDesignPointCompletionUserPrompt({
													state,
													currentText: state.designPointDescription,
												}),
										},
									},
								},
							],
						},
						{
							value: DESIGN_TYPE.SERIES,
							sections: [
								{
									id: "seriesTheme",
									kind: "textarea",
									stateKey: "seriesTheme",
									title: t("section.seriesTheme", "系列主题"),
									required: true,
									placeholder: t(
										"placeholder.seriesTheme",
										"请输入，例如：都市通勤、复古学院、轻户外",
									),
									aiGenerate: {
										label: t("button.aiPlaceholder", "AI 生成"),
										loadingLabel: t("button.generating", "生成中…"),
										disabled: ({ state }) => !getPrototypeImages(state).length,
										completeImagePrompt: {
											referenceImages: ({ state }) =>
												getPrototypeImages(state),
											referencesMessage: t(
												"error.extraReferences",
												"请先上传原型图",
											),
											userPrompt: ({ state }) =>
												buildSeriesThemeCompletionUserPrompt({
													currentText: state.seriesTheme,
												}),
										},
									},
								},
							],
						},
					],
				},
				{
					id: "modelSelect",
					kind: "model-select",
					title: t("section.modelSelect", "AI 模型"),
				},
				{
					id: "canvasSize",
					kind: "size-control",
					title: t("section.canvasSize", "宽高比"),
				},
				{
					id: "resolution",
					kind: "resolution-select",
					title: t("section.resolution", "尺寸倍数"),
				},
				{
					id: "count",
					kind: "option-group",
					stateKey: "genCount",
					title: t("section.count", "生成数量"),
					deps: ["designType"],
					when: ({ state }) => state.designType !== DESIGN_TYPE.SERIES,
				},
				{
					id: "countSeries",
					kind: "option-group",
					stateKey: "genCount",
					title: t("section.count.series", "系列款数"),
					deps: ["designType"],
					when: ({ state }) => state.designType === DESIGN_TYPE.SERIES,
				},
			],
			generate: {
				buttonLabel: `✨ ${t("button.generate", "生成款式设计")}`,
				loadingLabel: t("button.generating", "生成中…"),
				getIdleHint: ({ state }) => {
					if (!getPrototypeImages(state).length) {
						return t("empty.prototypeImage", "请先上传原型图")
					}
					if (state.designType === DESIGN_TYPE.INSPIRATION && !state.inspirationImage) {
						return t("empty.inspirationImage", "请先上传灵感图")
					}
					if (state.designType === DESIGN_TYPE.BESTSELLER && !state.garmentCategory) {
						return t("empty.garmentCategory", "请先选择服装品类")
					}
					if (
						state.designType === DESIGN_TYPE.BESTSELLER &&
						state.garmentCategory === GARMENT_CATEGORY.MORE &&
						!state.garmentCategoryMore
					) {
						return t("empty.garmentCategoryMore", "请先选择更多品类")
					}
					if (state.designType === DESIGN_TYPE.SERIES && !state.seriesTheme) {
						return t("empty.seriesTheme", "请先输入系列主题")
					}
					return ""
				},
				isDisabled: ({ state }) => isGenerateDisabled(state),
				validate: ({ state, helpers }) => {
					const prototypeImages = getPrototypeImages(state)
					const maxReferenceImages = getMaxReferenceImages(state, helpers)
					for (const prototypeImage of prototypeImages) {
						const referenceImages = getReferenceImages(state, prototypeImage)
						if (referenceImages.length > maxReferenceImages) {
							return t("error.referenceLimit", "参考图数量已达当前模型上限")
						}
						if (
							helpers.collectReferenceIds(referenceImages).length !==
							referenceImages.length
						) {
							return t("error.references", "图片缺少可用于生成的资源标识")
						}
					}
					const selectedSize = helpers.getSelectedSize(state)
					if (!selectedSize?.genW || !selectedSize?.genH) {
						return t("error.noSize", "当前模型缺少可用尺寸配置")
					}
					return null
				},
				execute: async ({ state, helpers, generateAndPlace }) => {
					const requests = getPrototypeImages(state).map((prototypeImage) => {
						const selectedSize = helpers.getSelectedSize(state)
						const width = selectedSize.genW
						const height = selectedSize.genH

						return {
							model_id: state.modelId,
							prompt: buildGarmentStyleDesignPrompt({
								state,
								locale: promptLocale,
							}),
							reference_images: helpers.collectReferenceIds(
								getReferenceImages(state, prototypeImage),
							),
							size: `${width}x${height}`,
							resolution: state.scale || undefined,
							width,
							height,
							count: state.genCount,
							select: false,
						}
					})

					const results = await Promise.all(
						requests.map((request) => generateAndPlace(request)),
					)
					return results.length === 1 ? results[0] : results
				},
			},
		})
	},
})
