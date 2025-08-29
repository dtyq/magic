# PageContainer 📄 Componente Contenitore Pagina

`PageContainer` è un componente contenitore utilizzato per avvolgere il contenuto della pagina, fornendo un layout di pagina unificato, una barra del titolo e funzionalità di chiusura.

## Proprietà

| Nome Proprietà | Tipo       | Valore Predefinito | Descrizione                          |
| -------------- | ---------- | ------------------ | ------------------------------------ |
| icon           | ReactNode  | -                  | Icona prima del titolo della pagina  |
| closeable      | boolean    | false              | Se mostrare il pulsante di chiusura  |
| onClose        | () => void | -                  | Funzione di callback per il clic sul pulsante di chiusura |
| className      | string     | -                  | Nome classe personalizzato del contenitore |
| ...CardProps   | -          | -                  | Supporta tutte le proprietà di Ant Design Card |

## Utilizzo Base

```tsx
import { PageContainer } from '@/components/base/PageContainer';
import { IconHome } from '@tabler/icons-react';

// Utilizzo base
<PageContainer title="Titolo Pagina">
  <div>Contenuto Pagina</div>
</PageContainer>

// Pagina con icona
<PageContainer
  title="Home"
  icon={<IconHome size={20} />}
>
  <div>Contenuto Home</div>
</PageContainer>

// Pagina chiudibile
<PageContainer
  title="Pagina Dettagli"
  closeable
  onClose={() => console.log('Pagina chiusa')}
>
  <div>Contenuto Pagina Dettagli</div>
</PageContainer>

// Stile intestazione personalizzato
<PageContainer
  title="Intestazione Personalizzata"
  headStyle={{ background: '#f0f2f5' }}
>
  <div>Contenuto Pagina</div>
</PageContainer>

// Utilizzo in layout
<Layout>
  <Layout.Sider>Barra Laterale</Layout.Sider>
  <Layout.Content>
    <PageContainer title="Area Contenuto Principale">
      <div>Contenuto Principale</div>
    </PageContainer>
  </Layout.Content>
</Layout>

// Utilizzo annidato
<PageContainer title="Pagina Esterna">
  <div style={{ padding: '20px' }}>
    <PageContainer title="Pagina Interna">
      <div>Contenuto Interno</div>
    </PageContainer>
  </div>
</PageContainer>
```

## Caratteristiche ✨

1. **Layout Unificato** 📐: Fornisce una struttura di layout di pagina unificata
2. **Design Responsivo** 📱: Si adatta automaticamente a diverse dimensioni dello schermo
3. **Adattamento Tema** 🌙: Si adatta automaticamente a temi chiari/scuri
4. **Barra Titolo Fissa** 📌: La barra del titolo rimane fissa in alto durante lo scorrimento
5. **Funzionalità Chiusura** ❌: Può aggiungere un pulsante di chiusura per la navigazione in app multipagina

## Quando Usare

-   Quando è necessario fornire una struttura di layout unificata per la pagina
-   Quando la pagina necessita di una barra del titolo e funzionalità di chiusura
-   Quando si creano più pagine con aspetto coerente nell'app
-   Quando la barra del titolo della pagina deve rimanere visibile durante lo scorrimento
-   Quando è necessario mostrare icone e titoli nella pagina

Il componente PageContainer rende il layout della tua pagina più unificato e professionale, adatto a vari scenari che richiedono pagine strutturate.

---

## Testo Originale (Cinese/Inglese)
# PageContainer 页面容器组件

`PageContainer` 是一个用于包裹页面内容的容器组件，提供了统一的页面布局、标题栏和关闭功能。

## 属性

| 属性名       | 类型       | 默认值 | 说明                            |
| ------------ | ---------- | ------ | ------------------------------- |
| icon         | ReactNode  | -      | 页面标题前的图标                |
| closeable    | boolean    | false  | 是否显示关闭按钮                |
| onClose      | () => void | -      | 点击关闭按钮的回调函数          |
| className    | string     | -      | 容器的自定义类名                |
| ...CardProps | -          | -      | 支持所有 Ant Design Card 的属性 |

## 基础用法

```tsx
import { PageContainer } from '@/components/base/PageContainer';
import { IconHome } from '@tabler/icons-react';

// 基础用法
<PageContainer title="页面标题">
  <div>页面内容</div>
</PageContainer>

// 带图标的页面
<PageContainer
  title="首页"
  icon={<IconHome size={20} />}
>
  <div>首页内容</div>
</PageContainer>

// 可关闭的页面
<PageContainer
  title="详情页"
  closeable
  onClose={() => console.log('页面关闭')}
>
  <div>详情页内容</div>
</PageContainer>

// 自定义页头样式
<PageContainer
  title="自定义页头"
  headStyle={{ background: '#f0f2f5' }}
>
  <div>页面内容</div>
</PageContainer>

// 在布局中使用
<Layout>
  <Layout.Sider>侧边栏</Layout.Sider>
  <Layout.Content>
    <PageContainer title="主内容区">
      <div>主要内容</div>
    </PageContainer>
  </Layout.Content>
</Layout>

// 嵌套使用
<PageContainer title="外层页面">
  <div style={{ padding: '20px' }}>
    <PageContainer title="内层页面">
      <div>内层内容</div>
    </PageContainer>
  </div>
</PageContainer>
```

## 特点

1. **统一布局**：提供了统一的页面布局结构
2. **响应式设计**：自动适应不同屏幕尺寸
3. **主题适配**：自动适应亮色/暗色主题
4. **标题栏固定**：标题栏会在滚动时保持固定在顶部
5. **关闭功能**：可以添加关闭按钮，方便在多页面应用中导航

## 何时使用

-   需要为页面提供统一的布局结构时
-   需要页面有标题栏和关闭功能时
-   需要在应用中创建多个具有一致外观的页面时
-   需要页面标题栏在滚动时保持可见时
-   需要在页面中显示图标和标题时

PageContainer 组件让你的页面布局更加统一和专业，适合在各种需要结构化页面的场景下使用。
