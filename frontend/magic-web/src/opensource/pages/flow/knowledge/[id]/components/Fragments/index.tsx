import MagicEmpty from "@/opensource/components/base/MagicEmpty"
import type { Knowledge } from "@/opensource/types/knowledge"
import { IconTrash } from "@tabler/icons-react"
import { Flex, Modal } from "antd"
import { createStyles, cx } from "antd-style"
import type { Dispatch, RefObject, SetStateAction } from "react"
import { useMemo, createRef } from "react"
import { useMemoizedFn } from "ahooks"
import { t } from "i18next"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { hasEditRight } from "@/opensource/pages/flow/components/AuthControlButton/types"
import { KnowledgeApi } from "@/opensource/apis"
import type { AddFragmentRef } from "../AddFragment"
import AddFragment from "../AddFragment"
import FragmentMenu from "./FragmentMenu"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

const useFragmentsStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		wrapper: css`
			width: 100%;
			height: 100%;
			background-color: ${isDarkMode ? token.magicColorScales.grey[9] : token.magicColorUsages.white};
			border-radius: 8px;
			padding: 12px 100px;
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1]};
			overflow-y: auto;
			.fragment {
				border-radius: 4px;
				padding: 8px;
				&:hover {
					background-color: ${isDarkMode ? token.magicColorScales.grey[8] : token.magicColorScales.grey[0]};

					.iconEdit {
						border: 1px solid transparent;
						color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorScales.grey[4]};
						background: ${isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.white};
						box-shadow:${
							isDarkMode
								? "none"
								: "0px 4px 14px 0px rgba(0, 0, 0, 0.1), 0px 0px 1px 0px rgba(0, 0, 0, 0.3);"
						}
						&:hover {
							background: ${isDarkMode ? token.magicColorScales.grey[3] : token.magicColorScales.grey[0]};
						}
					}
				}
				& > .content {
					background-color: rgba(110, 117, 237, 0.18);
					max-width: 70vw;
					overflow: auto;
				}
				.iconEdit {
					padding: 4px;
					cursor: pointer;
					border-radius: 4px;
					color: transparent;
				}
			}
		`,

		oddFragment: css`
			& > .content {
				background-color: rgba(255, 30, 86, 0.15) !important;
			}
		`,
		empty: css`
			margin-top: 0;
			padding-top: 20px;
		`,
	}
})

type FragmentsProps = {
	knowledge?: Knowledge.Detail
	knowledgeId: string
	fragments: Knowledge.FragmentItem[]
	setFragments: Dispatch<SetStateAction<Knowledge.FragmentItem[]>>
	initFragmentList: () => void
}

export default function Fragments({
	knowledge,
	knowledgeId,
	fragments,
	setFragments,
	initFragmentList,
}: FragmentsProps) {
	const { styles } = useFragmentsStyles()

	const deleteFragmentById = useMemoizedFn((id: string) => {
		setFragments(fragments.filter((fragment) => fragment.id !== id))
	})

	const editRefs = useMemo(() => {
		return fragments.reduce(
			(acc, fragment) => {
				acc[fragment.id] = createRef()
				return acc
			},
			{} as Record<string, RefObject<AddFragmentRef>>,
		)
	}, [fragments])

	const updateFragmentById = useMemoizedFn((id: string) => {
		const ref = editRefs?.[id]
		ref?.current?.showModal()
	})

	/** 删除片段 */
	const deleteItem = useMemoizedFn((fragment) => {
		Modal.confirm({
			centered: true,
			title: t("knowledgeDatabase.deleteFragment", { ns: "flow" }),
			content: t("knowledgeDatabase.deleteDesc", { ns: "flow" }),
			okText: t("button.confirm", { ns: "interface" }),
			cancelText: t("button.cancel", { ns: "interface" }),
			onOk: async () => {
				await KnowledgeApi.deleteFragment(fragment.id)
				magicToast.success(t("knowledgeDatabase.deleteFragmentSuccess", { ns: "flow" }))
				deleteFragmentById(fragment.id)
			},
		})
	})

	return (
		<div className={styles.wrapper}>
			<MagicSpin section spinning={false}>
				{fragments.map((fragment, i) => {
					return (
						<FragmentMenu
							fragment={fragment}
							deleteFragmentById={deleteFragmentById}
							updateFragmentById={updateFragmentById}
							key={fragment.id}
						>
							<Flex
								className={cx("fragment", {
									[styles.oddFragment]: i % 2 !== 0,
								})}
								justify="space-between"
								align="center"
							>
								<div className="content">{fragment?.content}</div>
								{!!knowledge?.user_operation &&
									hasEditRight(knowledge.user_operation) && (
										<Flex align="center" gap={6}>
											<AddFragment
												knowledgeId={knowledgeId}
												fragment={fragment}
												ref={editRefs[fragment.id]}
												initFragmentList={initFragmentList}
											/>
											<IconTrash
												className="iconEdit"
												onClick={() => deleteItem(fragment)}
											/>
										</Flex>
									)}
							</Flex>
						</FragmentMenu>
					)
				})}
				{fragments.length === 0 && <MagicEmpty className={styles.empty} />}
			</MagicSpin>
		</div>
	)
}
