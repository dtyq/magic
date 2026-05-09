---
name: slide-template
description: "Use when the user asks to create slides with a specific style, wants to see available PPT templates before creating, describes a custom template style, or wants to extract a template from an existing PPT project."
description-cn: "当用户想查看PPT模板、用特定风格制作幻灯片、描述自定义模板风格，或从现有PPT项目中抽象模板时使用。"
---

# Slide Template Manager

Use this skill to choose a built-in slide template,create a custom template from a style description,or extract one from an existing PPT project.

## Templates

| dir | name | visual cue | trigger keywords |
| --- | --- | --- | --- |
| `business-minimal` | Corporate Whitepaper/职场白皮书 | white + McKinsey-style deep blue (#1A56DB); dark cover/section pages; SWOT, KPI dashboard, waterfall chart layouts; strict whitespace; no decoration | business report,quarterly review,annual report,strategy deck,investor pitch,proposal,roadshow,financial analysis,corporate,企业汇报,季度报告,年报,商业分析,战略,投资人,财务,麦肯锡风格 |
| `tech-dark` | Midnight Code Lab/深夜代码室 | near-black deep navy (#070B14) + electric cyan (#00E5FF); glassmorphism cards; scan-line texture; code demo and architecture diagram layouts; gradient glow titles | tech talk,AI/ML product,engineering architecture,code demo,product launch,developer keynote,system design,技术分享,AI产品,架构设计,代码演示,工程师演讲,产品发布,开发者 |
| `creative-flat` | Neon Geometry/霓虹几何派 | flame orange (#FF4D1C) + creative purple (#6C27D9); zero shadows; hard-edged flat; diagonal color-block cuts; offset-shadow cards; dot-matrix texture | creative campaign,brand identity,advertising,design showcase,bold visual,new media,mood board,创意设计,品牌形象,广告方案,新媒体,视觉冲击,大胆配色 |
| `academic-research` | Academic Blueprint/论文蓝图册 | white + deep navy (#0F2444) + teal (#1A8A7A); Noto Serif SC titles; numbered sections, citation cards, experiment comparison tables; rigorous academic structure | thesis defense,academic paper,research presentation,conference paper,dissertation,SOTA comparison,methodology,论文答辩,学术汇报,研究报告,科研,学术会议,毕业答辩 |
| `gradient-fashion` | Glass Candy/玻璃糖果风 | deep purple to matte gold gradient (#4A00E0→#E8C96A); glassmorphism with top-edge highlight; nebula purple dark cover (#0D0825); large radii (16–24px); feature cards with gradient top lines | internet product,app launch,consumer SaaS,fashion brand,youth lifestyle,gradient style,互联网产品,App发布,消费品,时尚,年轻用户,渐变风格,玻璃拟态 |
| `aicon-tech-blue` | Orbit Tech Blue/旋转光环蓝 | white + professional blue (#2F80ED) + rotating dashed rings; dual conference logo areas; speaker introduction and code/architecture layout | AI conference,tech summit,engineering talk,speaker introduction,technical forum,AI大会,技术峰会,工程师分享,会议演讲,技术论坛 |
| `gotc-open-orange` | Open Source Triangle/开源三角橙 | white + open-source orange (#FF9933); left triangle accent bar (GOTC signature); code blocks and terminal components; dual conference logos | open source,developer community,GitHub,OSS conference,programming talk,developer event,开源社区,开发者大会,GitHub,程序员,开源峰会,技术贡献 |
| `charity-dark-green` | Deep Sea Green/深海绿光 | abyss ink (#010B14) + jade green (#2DD4A0) to dark jade cyan (#0EA5C9); multi-level glassmorphism; gold accent (#D4AF6A) for high-value numbers; restrained premium dark | charity,NGO,public welfare,social impact,environmental,sustainability,impact report,公益,慈善,NGO,社会影响力,环保,可持续发展,年度报告 |
| `neo-brutalism-bold` | Neo-Brutalism Bold/黑框硬核派 | gray-white (#F4F4F0) + pure black borders (4–8px) + flame red (#D92D20); offset solid shadows; ultra-heavy 900-weight titles; editorial collage rotations | internal training,startup pitch,founder deck,bold brand strategy,neo-brutalism,edgy design,内训,创业路演,野兽派设计,硬核品牌,强视觉冲击,创始人分享 |
| `museum-art-edu` | Museum Academy/米色学院堂 | warm ivory beige (#FAF8F5) + ink black + academy red (#C0392B); Noto Serif SC titles; light/dark page rhythm; museum label aesthetic; low-radius academic feel | art course,humanities,art appreciation,museum,cultural education,liberal arts,art history,classic literature,艺术课程,人文,美育,博物馆,艺术鉴赏,通识课,文化历史 |
| `edu-activity-orange` | Vibrant Classroom/活力课堂橙 | white content pages + dark navy cover; vivid orange (#F97316) sole accent; left-border principle cards; SBI framework cards; activity overview grids; dark goal boxes | classroom activity,workshop,team training,experiential learning,course design,interactive teaching,activity guide,课堂活动,工作坊,团队培训,体验式学习,课程设计,互动教学,活动手册 |
| `ink-classic` | Ink on Paper/洇墨纸张风 | ink black (#0A0A0B) + paper white (#F1EFEA); Playfair Display + IBM Plex Mono labels; zero rounded corners/shadows; WebGL noise texture; mandatory photo cover | academic research,ecology,policy report,think tank,science communication,high-quality report,humanities,学术报告,生态研究,政策分析,智库,科学传播,人文研究,高品质报告 |
| `monocle-editorial` | Editorial Redline/编辑室红线 | pure white + charcoal (#1A1A1A) + editorial red (#C8102E); Cormorant Garamond + DM Sans + DM Mono; magazine column grid system; masthead top bar | global affairs,cultural media,city report,editorial,journalism,brand magazine,Monocle style,全球事务,文化媒体,城市报告,编辑风格,高端杂志风,新闻叙事 |
| `blueprint` | Engineer's Blueprint/工程格线蓝 | off-white (#FAF8F5) + engineering blue (#2563EB); background grid lines simulate drafting paper; technical connector lines; flowchart and architecture diagram layouts | architecture design,engineering doc,system design,infrastructure,data analysis,technical review,blueprint,工程文档,架构设计,系统设计,基础设施,数据分析,技术评审,蓝图 |
| `notion` | Clean Dashboard/灰白看板风 | Notion light gray (#F7F7F5) + blue (#2383E2) + white cards; product-grade SaaS UI; Inter font; status tags, progress bars, property rows | SaaS product,B2B demo,dashboard,product roadmap,project overview,metrics,data board,产品演示,数据看板,SaaS,B2B,项目概览,指标报告,产品路线图 |
| `hand-drawn-edu` | Macaron Doodle/马卡龙涂鸦 | warm cream (#F5F0E8) + macaron color blocks (sky blue/mint/lavender/peach); ZCOOL KuaiLe relaxed font; hand-drawn borders with wobble; cartoon doodle decorations | popular science,course tutorial,process explanation,educational explainer,friendly training,doodle style,科普,课程教学,流程讲解,趣味培训,手绘风格,手账 |
| `vector-illustration` | Retro Picture Book/复古绘本风 | cream beige (#F5F0E6) + unified 2–3px black outlines; retro palette (coral/mint/mustard/slate); Playfair Display serif; geometric simplified characters; panoramic narrative scenes | brand story,product intro,warm narrative,retro illustration,picture book,heritage brand,品牌故事,产品介绍,温暖叙事,复古插画,品牌历史,文化传承 |
| `chalkboard` | Chalkboard Lettering/黑板粉笔字 | blackboard black (#1A1A1A) or green (#1C2B1C) + chalk white/yellow/pink/blue; Caveat handwritten font; doodle arrows and circled annotations; teaching narrative layout | teaching,classroom explanation,knowledge sharing,lecture,tutorial,educational keynote,黑板讲解,知识分享,课堂教学,粉笔风,手写字,教学演示 |
| `scientific` | Lab Diagram/实验室图解 | off-white (#FAFAFA) + color-coded pathways (teal/blue/purple); serif academic titles; annotation-driven; pathway/flow diagrams with arrows and labeled components | biology,chemistry,medicine,life sciences,pathway diagram,molecular biology,scientific explanation,生物,化学,医学,生命科学,通路图,分子生物学,实验讲解,科学示意图 |
| `vintage` | Parchment Scroll/羊皮卷古籍 | aged parchment (#F5E6D3) + deep brown + gold (#C9A227); Playfair Display + EB Garamond; antique map elements; compass ornaments; handwritten annotations | history,geography,cultural heritage,travel,museum,exploration,legacy brand,classical,历史,地理,文化遗产,旅行,博物馆,探险,传承品牌,古典风格 |
| `watercolor` | Coral Watercolor/珊瑚水彩晕 | warm white (#FAF8F0) + coral (#F4A261) + sage green (#87A96B); Dancing Script handwritten font; watercolor wash textures; organic shapes; natural element decorations | lifestyle,health,wellness,food,travel,personal brand,artisan,watercolor,生活方式,健康,美食,旅行,个人品牌,水彩,手工感,感性温暖 |
| `intuition-machine` | Cream Infographic/奶油信息图 | aged cream (#F5F0E6) + teal (#2F7373) + maroon (#7A2F37); bilingual labels (English term + Chinese); black outlines; technical print aesthetic; information-dense split layouts | concept breakdown,infographic,bilingual presentation,deep explanation,knowledge explainer,technical education,概念拆解,信息图,双语说明,深度解析,知识科普,技术教育 |
| `fantasy-animation` | Ghibli Fairy Tale/吉卜力童话 | soft sky blue (#E8F4FC) + deep forest green (#2D5A3D) + gold (#F4D03F); Ghibli/Disney narrative; character-driven layouts; watercolor wash background; magical star and sparkle decorations | children,story,fantasy,animation,fairy tale,kids education,storybook,imagination,儿童,故事,奇幻,动画,童话,绘本,想象力,亲子 |
| `dark-atmospheric` | Dark Neon Glow/暗夜霓虹光 | void black (#060610) + deep purple (#9D6FFF) + ice cyan (#22D3EE); cinematic spotlight gradients; 5-layer background depth; dramatic focal design; restrained lower-saturation neon | music event,entertainment,concert,gaming,premium product launch,brand reveal,nightlife,film,音乐活动,娱乐,演唱会,游戏,高端发布会,品牌揭幕,夜场,电影感 |

## Decision

- Explicit template name/dir/alias:use it directly.
- User describes concrete visual style(colors,materials,layout,decorative elements,visual keywords;配色/材质/版式/装饰/视觉关键词):generate a custom template first,then use it.
- User only describes scenario/topic/audience(场景/主题/受众) without enough visual specs:recommend 3-5 built-in templates with `ask_user`.
- `ask_user` options must include name+short description+dir,and include "no template/default style".
- If the user asks to see templates,show suitable options and mention previews at `<skill_dir>/assets/templates/<dir>/preview.html` (see Built-In Template Workflow for `<skill_dir>`).
- Editing/fixing/refactoring existing slides does not trigger template selection unless the user asks for a new PPT/project.

## Built-In Template Workflow

Do not resolve this skill's bundled templates under `.magic/skills/slide-template/`. After `read_skills(skill_names=["slide-template"])`, read the absolute skill root from the `<skill_dir>` tag (or parent of `<location>`). In examples below, `<skill_dir>` is that directory. Use `read_files` and `cp` sources only as fully qualified paths: `<skill_dir>/` plus the relative paths listed in this skill.

1.Load selected spec and preview gallery:

```
read_files(files=[
  {"file_path":"<skill_dir>/assets/templates/<dir>/visual-spec.md"},
  {"file_path":"<skill_dir>/assets/templates/<dir>/preview.html"}
])
```

2.Treat `preview.html` as the template example gallery. Before writing slides, inspect its Color Palette/Color System, Layout Page Types, and Core/Extended Components sections. Extract concrete page structures, component patterns, color-role usage, spacing rhythm, and visual anchors. For each slide, choose the closest preview layout or component pattern and adapt it to the user's content.

3.Do not copy preview wrapper styles such as `preview-header`, `slides-grid`, `slide-wrap`, or tiny thumbnail sizing into final slide pages. Do not link `preview.html` from generated slides. The preview demonstrates composition and proportions; final slides must still be fixed 1920x1080 pages using local `theme.css`, template CSS variables/classes, and the Google Fonts link from `visual-spec.md`.

4.Authority order: `theme.css` owns final CSS variables, fonts, decorations, components, layout helpers, and fixed canvas reset. `visual-spec.md` owns design rules, typography, Google Fonts link, layout types, ECharts rules, and image style guidance. `preview.html` demonstrates how to apply them. If `preview.html` conflicts with `theme.css` or `visual-spec.md`, follow `theme.css`/`visual-spec.md` and use preview only as composition guidance.

5.Before creating slide pages, summarize the template internally: palette roles, layout inventory from `.slide-label`, component inventory from Core/Extended Components, composition rules such as header/footer, grid columns, visual anchors, and the adaptation rule for replacing demo content while preserving structure, color roles, and rhythm.

6.Create project with `create_slide_project`,then copy CSS to project root before creating slide pages (use absolute source path):

```
shell_exec(command="cp <skill_dir>/assets/templates/<dir>/theme.css <project>/theme.css")
```

7.Each slide HTML must include local CSS and the Google Fonts `<link>` declared in `visual-spec.md`:

```html
<link rel="stylesheet" href="theme.css" />
```

8.Load `creating-slides` and generate slides. Keep every slide fixed at 1920x1080; do not use responsive design. Use only template CSS variables,components,dedicated layout types,ECharts rules,and image guidance from `visual-spec.md`/`theme.css`. Prefer a matching dedicated layout from `visual-spec.md` or `preview.html`; if none fits, compose the page from template components,decorations,and layout helpers instead of generic centered text. Each slide should have one clear visual anchor, such as an image area,chart,matrix,large number,color block,or template-specific decoration.

9.Never link to skill files or assets outside the PPT project. All images/assets used by slides must be inside the PPT project,usually under `images/`.

## Image Rules

- First decide whether the page needs images. Use images for visual layouts,cover/section/closing pages,specific person/product/scene/case,or sparse text.
- Skip image search for dense comparison,card grid,timeline/process,data dashboard,or chart pages.
- Prefer `image_search`. Try at least 2 content-relevant keyword groups and include template style keywords from `visual-spec.md`.
- If search results are poor,use `generate_images` and save output under the PPT project `images/` folder.
- Apply template style only to creative illustrations(concept visuals,atmosphere,decorative or abstract images). Do not stylize factual photos,real people,real places,products,history/science references,brand marks,screenshots,QR codes,or data graphics.
- Images should occupy meaningful visual space; do not use them as tiny icons.
- Images can be used as local section backgrounds with an overlay when they support the content and template style.
- If a slide skips images,use a non-image visual anchor instead of leaving sparse text floating in empty space.
- Do not repeat the same background-image treatment on most consecutive slides.

## Custom Template Workflow

Use when the user describes a style in text, provides screenshots, or gives an existing PPT project. Read `<skill_dir>/references/custom-template-workflow.md` and follow it before generating custom template files.

## Style Specificity & Template Scope

- `theme.css` must only contain template-specific styles: color variables, background decorations, typography, template components, and visual helpers. It must NOT contain structural layout properties (padding, flex, grid) on framework-level selectors like `.slide-container`.
- `.slide-container` in `theme.css` should only set: dimensions (`width`/`height`), `position`, `overflow`, `box-sizing`, and template-specific backgrounds/colors. Layout properties (`padding`, `margin`, `display: flex`, `flex-direction`) must be defined in each slide page's own `<style>` block.
- Page-level `<style>` in each slide HTML has higher specificity than `theme.css` by nature of source order (page styles load after `theme.css`). If needed, use more specific selectors (e.g., `.slide-container.my-page`) to ensure page styles override template defaults.
- When writing slide pages, always define layout (padding, flex, grid) directly in the page `<style>` rather than relying on `theme.css`, to avoid cross-page style conflicts.

## Output

- Built-in/custom workflow output:a complete slide project generated through `creating-slides`.
- Custom template output must include `visual-spec.md`,`theme.css`,`preview.html`.
- Do not paste raw HTML in chat.
