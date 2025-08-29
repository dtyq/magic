# MagicModal 🪄 Componente Modale Magico

`MagicModal` è una versione migliorata del componente Modal di Ant Design, che offre stili più belli e supporto per l'internazionalizzazione.

## Proprietà

| Nome Proprietà | Tipo | Valore Predefinito | Descrizione                          |
| -------------- | ---- | ------------------ | ------------------------------------ |
| ...ModalProps  | -    | -                  | Supporta tutte le proprietà del Modal di Ant Design |

## Metodi Statici

MagicModal fornisce gli stessi metodi statici del Modal di Ant Design, ma con supporto per l'internazionalizzazione e ottimizzazioni di stile:

-   `MagicModal.confirm(config)` - Dialogo di conferma ✅
-   `MagicModal.info(config)` - Dialogo informativo ℹ️
-   `MagicModal.success(config)` - Dialogo di successo 🎉
-   `MagicModal.error(config)` - Dialogo di errore ❌
-   `MagicModal.warning(config)` - Dialogo di avviso ⚠️

## Uso Base

```tsx
import { MagicModal } from "@/components/base/MagicModal"
import { useState } from "react"

// Dialogo base
const MyComponent = () => {
	const [isModalOpen, setIsModalOpen] = useState(false)

	return (
		<>
			<button onClick={() => setIsModalOpen(true)}>Apri Dialogo</button>
			<MagicModal
				title="Titolo del Dialogo"
				open={isModalOpen}
				onOk={() => setIsModalOpen(false)}
				onCancel={() => setIsModalOpen(false)}
			>
				<p>Questo è il contenuto del dialogo</p>
			</MagicModal>
		</>
	)
}

// Usando metodi statici
const showConfirm = () => {
	MagicModal.confirm({
		title: "Conferma Operazione",
		content: "Sei sicuro di voler eseguire questa operazione?",
		onOk() {
			console.log("L'utente ha cliccato conferma")
		},
		onCancel() {
			console.log("L'utente ha cliccato annulla")
		},
	})
}

// Suggerimento informativo
const showInfo = () => {
	MagicModal.info({
		title: "Suggerimento Informativo",
		content: "Questa è un'informazione importante",
	})
}

// Suggerimento di successo
const showSuccess = () => {
	MagicModal.success({
		title: "Operazione Riuscita",
		content: "I dati sono stati salvati con successo",
	})
}

// Suggerimento di errore
const showError = () => {
	MagicModal.error({
		title: "Operazione Fallita",
		content: "Errore durante il salvataggio dei dati",
	})
}

// Suggerimento di avviso
const showWarning = () => {
	MagicModal.warning({
		title: "Avviso",
		content: "Questa operazione potrebbe causare perdita di dati",
	})
}
```

## Caratteristiche

1. **Stili Ottimizzati** 🎨: Testata, area contenuto e piè di pagina hanno ottimizzazioni di stile specifiche
2. **Icone Personalizzate** 🖼️: Fornisce icone personalizzate per dialoghi di tipo info, ecc.
3. **Ottimizzazioni Stile Pulsanti** 🔘: I pulsanti del dialogo hanno stili e esperienze interattive migliori

## Quando Usare

-   Quando hai bisogno che l'utente gestisca transazioni senza interrompere il flusso di lavoro con un reindirizzamento pagina 📄
-   Quando devi mostrare suggerimenti di sistema 💬
-   Quando devi mostrare feedback in forma di dialogo 📢
-   Quando devi eseguire conferme utente ✅

Il componente MagicModal rende i tuoi dialoghi più belli e user-friendly, fornendo al contempo supporto completo per l'internazionalizzazione.

---

## Testo Originale (Cinese e Inglese)

# MagicModal 魔法对话框组件

`MagicModal` 是一个基于 Ant Design Modal 组件的增强版对话框，提供了更美观的样式和国际化支持。

## 属性

| 属性名        | 类型 | 默认值 | 说明                             |
| ------------- | ---- | ------ | -------------------------------- |
| ...ModalProps | -    | -      | 支持所有 Ant Design Modal 的属性 |

## 静态方法

MagicModal 提供了与 Ant Design Modal 相同的静态方法，但增加了国际化支持和样式优化：

-   `MagicModal.confirm(config)` - 确认对话框
-   `MagicModal.info(config)` - 信息对话框
-   `MagicModal.success(config)` - 成功对话框
-   `MagicModal.error(config)` - 错误对话框
-   `MagicModal.warning(config)` - 警告对话框

## 基础用法

```tsx
import { MagicModal } from "@/components/base/MagicModal"
import { useState } from "react"

// 基础对话框
const MyComponent = () => {
	const [isModalOpen, setIsModalOpen] = useState(false)

	return (
		<>
			<button onClick={() => setIsModalOpen(true)}>打开对话框</button>
			<MagicModal
				title="对话框标题"
				open={isModalOpen}
				onOk={() => setIsModalOpen(false)}
				onCancel={() => setIsModalOpen(false)}
			>
				<p>这是对话框的内容</p>
			</MagicModal>
		</>
	)
}

// 使用静态方法
const showConfirm = () => {
	MagicModal.confirm({
		title: "确认操作",
		content: "你确定要执行这个操作吗？",
		onOk() {
			console.log("用户点击了确认")
		},
		onCancel() {
			console.log("用户点击了取消")
		},
	})
}

// 信息提示
const showInfo = () => {
	MagicModal.info({
		title: "信息提示",
		content: "这是一条重要信息",
	})
}

// 成功提示
const showSuccess = () => {
	MagicModal.success({
		title: "操作成功",
		content: "数据已成功保存",
	})
}

// 错误提示
const showError = () => {
	MagicModal.error({
		title: "操作失败",
		content: "保存数据时出现错误",
	})
}

// 警告提示
const showWarning = () => {
	MagicModal.warning({
		title: "警告",
		content: "此操作可能导致数据丢失",
	})
}
```

## 特点

1. **优化的样式**：头部、内容区、底部都有特定的样式优化
2. **自定义图标**：为 info 等类型的对话框提供了自定义图标
3. **按钮样式优化**：对话框按钮有更好的样式和交互体验

## 何时使用

-   需要用户处理事务，又不希望跳转页面以致打断工作流程时
-   需要显示系统的提示信息时
-   需要展示对话框形式的反馈信息时
-   需要进行用户确认操作时

MagicModal 组件让你的对话框更加美观和用户友好，同时提供了完善的国际化支持。
