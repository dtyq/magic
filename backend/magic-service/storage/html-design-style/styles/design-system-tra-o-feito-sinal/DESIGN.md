---
name: Traço/Feito — SINAL
description: Manual de Procedimentos. Campo neutro quase vazio. Um único sinal de cor inesperado — verde botânico profundo. A barra dourada como o único calor. O conteúdo carrega, o sistema não ornamente.
colors:
  pedra: "#FAF9F7"
  tinta: "#191210"
  cinza-texto: "#7A6E60"
  cinza-regua: "#E5E1DC"
  verde-botanico: "#275E3F"
  verde-medio: "#4A8A62"
  verde-claro: "#D4E8DC"
  barra-gold: "#C89B6E"
typography:
  display:
    fontFamily: "'Cormorant Garamond', 'Garamond', 'Palatino', serif"
    fontSize: "clamp(48px, 6vw, 96px)"
    fontWeight: 300
    lineHeight: 1.0
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "'Cormorant Garamond', 'Garamond', serif"
    fontSize: "36px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "normal"
  subheading:
    fontFamily: "'Work Sans', system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "'Work Sans', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "'Work Sans', system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.14em"
  citacao:
    fontFamily: "'Cormorant Garamond', serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.01em"
rounded:
  xs: "2px"
  sm: "4px"
  md: "6px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  10: "40px"
  12: "48px"
  16: "64px"
  20: "80px"
  24: "96px"
  32: "128px"
components:
  button-primary:
    backgroundColor: "{colors.verde-botanico}"
    textColor: "{colors.pedra}"
    rounded: "{rounded.sm}"
    padding: "10px 24px"
  button-primary-hover:
    backgroundColor: "{colors.verde-medio}"
    textColor: "{colors.pedra}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.tinta}"
    rounded: "{rounded.sm}"
    padding: "10px 24px"
    border: "1px solid {colors.cinza-regua}"
  button-secondary-hover:
    backgroundColor: "{colors.cinza-regua}"
    textColor: "{colors.tinta}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.verde-botanico}"
    rounded: "{rounded.sm}"
    padding: "10px 24px"
  button-ghost-hover:
    backgroundColor: "{colors.verde-claro}"
    textColor: "{colors.verde-botanico}"
  tag:
    backgroundColor: "{colors.verde-claro}"
    textColor: "{colors.verde-botanico}"
    rounded: "{rounded.xs}"
    padding: "4px 10px"
  tag-dark:
    backgroundColor: "{colors.verde-botanico}"
    textColor: "{colors.pedra}"
    rounded: "{rounded.xs}"
    padding: "4px 10px"
  tag-neutro:
    backgroundColor: "{colors.cinza-regua}"
    textColor: "{colors.cinza-texto}"
    rounded: "{rounded.xs}"
    padding: "4px 10px"
---

# Design System: Traço/Feito — SINAL

## 1. Overview

**Creative North Star: "O Manual de Procedimentos"**

Tudo que não é essencial foi removido. O que sobra tem peso absoluto. A superfície é pedra — branco com mínimo de temperatura, sem o aconchego do papel cru, sem o calor do drafting paper. Fria e precisa como mármore polido ou papel de impressão de alta gramatura.

Num campo assim, um único sinal de cor faz todo o trabalho de identidade. O sinal escolhido é um verde botânico profundo: não sage wellness, não emerald luxury, não verde-natureza genérico. É o verde de uma gravura botânica do século XVIII, de uma edição Penguin Classics dos anos 60, de um Letraset de transferência. Um verde que tem história e especificidade — completamente fora do espectro de qualquer competidor no mercado de metodologia e L&D.

A barra dourada flutua como o único calor num campo quase vazio. Dois sinais distintos que não competem: o verde é o sistema, o ouro é a identidade. A tensão entre os dois cria uma terceira coisa — interesse visual que não depende de ornamento.

Cormorant Garamond em tamanho grande é a aposta tipográfica mais arriscada das três direções. Suas hastes finas têm a qualidade de uma gravura em metal — só funcionam em escala grande. Em tamanhos médios e pequenos, Work Sans assume sem hesitação.

**Key Characteristics:**
- Campo neutro de pedra branca como superfície primária
- Um único sinal de cor: verde botânico (#275E3F) — inesperado e preciso
- Barra dourada como calor singular — preservada sem alteração
- Cormorant Garamond Light em escala de gravura para display
- Sistema de máxima longevidade — escala para livro, método publicado, identidade acadêmica

Este sistema rejeita: minimalismo como postura (o espaço existe porque o conteúdo o exige, não como declaração estética); verde wellness (sage, mint — completamente diferente deste); verde de sustentabilidade (bright eco-green); a ilusão de que espaço vazio é sofisticação por si só (a densidade do conteúdo valida a generosidade do espaço).

**A proteção contra o trap do minimalismo vazio:** Este sistema só funciona com copy preciso e específico. Ele expõe a pobreza do conteúdo sem misericórdia. Se o texto for vago ou motivacional, o sistema revela isso. Se for denso e específico, o sistema o amplifica.


## 2. Colors: A Paleta do Sinal Único

Dois grupos: campo neutro (quatro valores) + sinal botânico (três valores) + barra dourada (um valor). O verde nunca é casual — cada aparição é decisão editorial.

### Ground Neutro
- **Pedra** (#FAF9F7 / oklch(98% 0.003 85)): O fundo primário. Branco de mármore — quase imperceptivelmente quente (H=85, direção âmbar muito suave). Mais frio que o Papel Cru do sistema original. Precisão, não aconchego.
- **Tinta** (#191210 / oklch(13% 0.014 62)): Texto principal. Quase-preto levemente quente (não azulado). A temperatura é mínima mas essencial — evita o preto sem vida.
- **Cinza Texto** (#7A6E60 / oklch(55% 0.018 65)): Metadados, legendas, textos de suporte. Quente o suficiente para não parecer cinza frio de sistema UI.
- **Cinza Régua** (#E5E1DC / oklch(90% 0.006 80)): Separadores, bordas de cards, linhas de grid. Quase invisível no campo Pedra — estrutura mínima.

### Sinal Botânico
- **Verde Botânico** (#275E3F / oklch(40% 0.15 142)): O sinal de identidade. CTAs primários, eyebrows, labels, links. O único lugar onde cor "acontece" no sistema. Reservado e preciso.
- **Verde Médio** (#4A8A62 / oklch(58% 0.12 142)): Hover de botão primário. Links inline. Feedback de hover em elementos interativos verdes.
- **Verde Claro** (#D4E8DC / oklch(91% 0.05 142)): Background de tags verdes, destaques suaves, tints de seleção.

### Barra — Calor Singular
- **Barra Gold** (#C89B6E / oklch(74% 0.09 70)): Preservada com fidelidade ao original. No campo neutro e verde deste sistema, o ouro é ainda mais exótico do que no sistema atual. Uso: logo/barra, estados de foco em inputs.

### Named Rules
**A Regra do Sinal Único.** O verde botânico é o único sinal de cor. Sem azul de link, sem vermelho de erro não-adaptado, sem laranja de atenção. Cada cor de estado de interface (erro, sucesso, aviso) é derivada do espectro do sinal único ou do gold da barra. Vermelho de erro: oklch(45% 0.14 28) — quente, nunca frio. Verde de sucesso: um tom mais claro do próprio sinal botânico.

**A Regra dos Dois Calores.** O gold e o verde botânico são distintos em temperatura (quente vs. frio-botânico) e em papel (identidade vs. sistema). Eles nunca aparecem no mesmo elemento. Em composições, mantêm distância — um na parte superior, outro na inferior, ou em hierarquias diferentes.


## 3. Typography: Gravura e Protocolo

**Display Font:** [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond) Light — A escolha mais específica das três direções. Haste extrafina com qualidade de gravura em metal. Em peso Light (300) em tamanhos grandes (48px+), tem presença que serifas de haste grossa não têm — uma leveza que paradoxalmente ocupa espaço. Usado em romano. Não itálico como regra.

**Body Font:** [Work Sans](https://fonts.google.com/specimen/Work+Sans) — Grotesca humanista equilibrada. Mais quente que Inter, menos característica que Syne. Peso Regular (400) no corpo — não Light, porque o Cormorant Light já introduz a leveza, e o corpo precisa de ancoragem.

**Lógica do par:** Cormorant Garamond (o traço — milênios de tipografia serifada, hastes finas que só a mão e o metal conseguem fazer) + Work Sans (o feito — digital, limpo, funcional). A distância histórica entre os dois é maior do que qualquer outro par das três direções.

**Cormorant só em grande:** Abaixo de 24px, as hastes finas do Cormorant em Light perdem legibilidade em telas. Work Sans é obrigatório em todos os tamanhos de corpo.

### Hierarquia

| Nível | Fonte | Peso | Tamanho | Regra |
|---|---|---|---|---|
| Display | Cormorant Garamond | 300 | clamp(48px, 6vw, 96px) | Romano. Tracking -0.01em. Tamanho mínimo: 48px. |
| Headline | Cormorant Garamond | 500 | 36–44px | Romano. Medium weight para mais presença em headline. |
| Subheading | Work Sans | 600 | 18–20px | Transição limpa para o sistema sans. Sem itálico. |
| Body | Work Sans | 400 | 16px | Line-height 1.65. Máx 70ch. Regular, não Light. |
| Label / Eyebrow | Work Sans | 600 | 10px | CAIXA ALTA. Tracking 0.14em. Cor Verde Botânico — único uso de cor no texto. |
| Citação | Cormorant Garamond | 400 | 22px | Itálico admitido aqui — o único contexto. Para depoimentos e citações literais. |
| Caption | Work Sans | 400 | 12px | Cor Cinza Texto. Para metadados de fotografia. |

### Named Rules
**A Regra da Gravura.** Cormorant Garamond só existe em tamanhos grandes. Em tamanhos de corpo, ele perde o que o torna especial. Work Sans é o idioma de tudo abaixo de 24px.

**A Regra do Eyebrow Verde.** Os eyebrows (categoria, tipo, rótulo de seção) em Work Sans caixa alta com tracking largo e cor Verde Botânico são o único lugar onde o sinal de cor aparece no texto. Isso torna o eyebrow o componente de identidade mais forte do sistema — mais do que o logo em alguns contextos.


## 4. Elevation

Máxima planitude. O campo Pedra (#FAF9F7) como ground absoluto. Cards usam fundo branco ligeiramente mais "frio" (oklch(99% 0.002 85)) sobre o Pedra quente — a inversão de temperatura cria separação sem tonal de luminosidade.

Bordas de 1px Cinza Régua (#E5E1DC) definem todos os cards e containers. A borda é o único elemento estrutural visível.

Sem sombras em nenhum contexto exceto elementos flutuantes funcionais (dropdowns, tooltips) com sombra muito difusa (oklch opacidade ≤ 0.05, blur ≥ 32px, deslocamento zero).

**A Regra da Inversão Fria.** Cards em campo Pedra (#FAF9F7) têm fundo em oklch(99% 0.002 85) — ligeiramente mais frio e branco que o ground. A inversão de temperatura (ground levemente quente → card levemente frio) cria profundidade sem adicionar sombra ou tonal escuro. É uma separação quase secreta.


## 5. Components

### Buttons

- **Primary (Verde Botânico como fundo):** Fundo #275E3F, texto #FAF9F7, padding 10px 24px, raio 4px. Hover: Verde Médio (#4A8A62). O CTA mais claro das três direções — o verde é inesperado e memorável. Um por área de decisão.
- **Secondary:** Transparent + borda 1px Cinza Régua, texto Tinta. Hover: fundo Cinza Régua. Suavíssimo — para ações que não querem chamar atenção.
- **Ghost (Verde):** Transparent + sem borda, texto Verde Botânico. Para links de navegação e ações terciárias. Hover: fundo Verde Claro.
- **Focus:** Outline 2px Barra Gold, offset 3px. O ouro marca o estado de foco — coerente com o papel da barra no sistema.

### Tags e Rótulos

- **Verde (padrão de identidade):** Fundo Verde Claro, texto Verde Botânico. Para categorias principais, modalidades do catálogo, tags de curso.
- **Verde escuro:** Fundo Verde Botânico, texto Pedra. Alta ênfase. Para tags de destaque ou estado "selecionado".
- **Neutro:** Fundo Cinza Régua, texto Cinza Texto. Para metadados que não precisam de ênfase de identidade.
- **Formato:** Raio 2px (quase reto). Barlow Condensed não — aqui é Work Sans 600, caixa alta, 10px, tracking 0.10em.

### Cards

- **Background:** oklch(99% 0.002 85) — levemente mais frio/branco que o ground Pedra.
- **Borda:** 1px Cinza Régua (#E5E1DC). A borda define o card.
- **Raio:** 6px.
- **Padding:** 24px 28px — mais generoso que os outros sistemas.
- **Hover:** Borda muda para Verde Médio (1px). Sutil transformação de identidade.
- **Estrutura interna:** Eyebrow (Work Sans, caixa alta, Verde Botânico) → Título (Cormorant Garamond 500, romano) → Separador (1px Cinza Régua, 12px margem) → Corpo (Work Sans 400).

### Citações e Depoimentos

O componente mais poderoso deste sistema. Cormorant Garamond 400 Itálico em 22px com recuo de 32px à esquerda, cor Tinta, borda-left de 2px Verde Botânico.

Esta é a única exceção às regras do itálico — e a única vez que borda-left é admitida (espessura de 2px, como linha de margem de caderno, não como stripe decorativa).

### Fotografia

- **Imagens P&B:** Sangram até a borda do container com borda de 1px Cinza Régua apenas na parte inferior (como base). A foto P&B contra o campo Pedra tem a qualidade de uma impressão fotográfica sobre papel de alta gramatura.
- **Imagens coloridas:** Contidas em containers com borda 1px Cinza Régua e raio 6px. A saturação das fotos coloridas (cartão pintado, câmeras) contrasta com o campo neutro — são os momentos mais vivos do sistema.
- **Legenda:** Work Sans 400, 12px, Cinza Texto. 8px abaixo da imagem.

### Barra como Elemento Estrutural

Neste sistema, a barra opera com delicadeza máxima.

**No logo:** preservada — o ouro flutuando no campo branco-pedra tem quase a qualidade de uma marca físca impressa.

**Como separador de seção:** a barra em 24–32px de altura, centrada horizontalmente, entre seções de texto longo. Nunca repetida no mesmo scroll.

**Em materiais de alta qualidade:** a barra impressa em ouro real (hot stamping) sobre papel de alta gramatura é o artefato físico mais elegante possível.

### Inputs

- **Default:** Fundo branco puro (#FFFFFF) sobre ground Pedra. Borda 1px Cinza Régua. Raio 4px. Padding 10px 14px.
- **Focus:** Borda muda para Verde Botânico (2px). O sinal aparece no estado de interação — coerente com o eyebrow verde.
- **Error:** Borda oklch(45% 0.14 28) — vermelho-quente, nunca frio.
- **Label:** Work Sans 600, 12px, Tinta. Acima do input.
- **Placeholder:** Cinza Texto (#7A6E60).


## 6. Do's and Don'ts

### Do:
- **Do** usar Cormorant Garamond apenas em tamanhos grandes (48px+). Em tamanho de corpo, ele não existe.
- **Do** reservar o verde botânico para elementos de identidade sistêmica: eyebrows, CTAs, labels, links. Sua raridade é o sinal — usá-lo demais dilui o efeito.
- **Do** usar espaço generoso — mas com conteúdo que justifica cada centímetro. Espaço vazio sem conteúdo específico é falha, não elegância.
- **Do** sangrar fotografias P&B até a borda do container — a foto sobre Pedra tem qualidade editorial que nenhum outro sistema das três direções consegue.
- **Do** usar eyebrows Work Sans caixa alta em verde botânico em toda seção que tenha categoria ou tipo. É o componente de identidade mais forte deste sistema.
- **Do** usar a barra com máxima delicadeza — em escala pequena como separador, nunca em escala de hero como no sistema CARBONO.
- **Do** usar o verde de foco nos inputs (2px, não 1px) — a borda de foco mais grossa é a confirmação de interação mais clara.
- **Do** usar citações com Cormorant itálico + borda-left de 2px Verde Botânico. É o componente de depoimento/autoridade mais elegante das três direções.

### Don't:
- **Don't** usar Cormorant em tamanhos de corpo. Abaixo de 24px, Work Sans assume sem exceção.
- **Don't** usar o verde botânico como cor de fundo de seção ou hero. É sinal, não território. Como fundo, ele perde a especificidade que o torna poderoso.
- **Don't** usar múltiplos sinais de cor além do verde botânico e do gold. Sem laranja, sem azul, sem roxo.
- **Don't** usar espaço em branco como postura estética. Este sistema só funciona com conteúdo denso e específico — se a copy for vaga, o sistema revela isso sem clemência.
- **Don't** glassmorphism. Sem blur, sem superfícies translúcidas.
- **Don't** gradient text.
- **Don't** usar side-stripe borders além das citações (onde a borda-left de 2px é admitida com função narrativa específica, não decorativa).
- **Don't** usar o logotipo em versão negativa (branco sobre escuro) neste sistema — o sistema não tem superfícies escuras primárias. Se precisar de uma superfície escura, use um bloco Verde Botânico como fundo de seção com texto Pedra.
- **Don't** usar a barra em escala ampliada como hero element. Neste sistema, a barra é delicada — sua força vem da precisão, não do tamanho.
