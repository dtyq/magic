import { observer } from "mobx-react"
import React, { ReactElement, RefObject, useContext } from "react"
import { SchemaMobxContext } from "../../index"
import Schema from "../../types/Schema"
import SchemaObject from "./schema-object"

export const mapping = (
	name: string[],
	data: Schema | undefined,
	showEdit: (
		prefix: string[],
		editorName: string,
		propertyElement: string | { mock: string },
		type?: string,
	) => void,
	showAdv: (prefix: string[], property?: Schema) => void,
	showExtraLine: boolean,
	setObjectLastItemOffsetTop?: React.Dispatch<React.SetStateAction<number>>
): React.ReactElement | null => {
	const nameArray = [...name].concat("properties")
	switch (data?.type) {
		case "array":
		case "object":
			return (
				<SchemaObject
					prefix={nameArray}
					data={data}
					showEdit={showEdit}
					showAdv={showAdv}
					showExtraLine={showExtraLine}
					setObjectLastItemOffsetTop={setObjectLastItemOffsetTop}
				/>
			)
		default:
			return null
	}
}

interface SchemaJsonProp {
	showEdit: (
		prefix: string[],
		editorName: string,
		propertyElement: string | { mock: string },
		type?: string,
	) => void
	showAdv: (prefix: string[], property?: Schema) => void
	showExtraLine: boolean
	setObjectLastItemOffsetTop: React.Dispatch<React.SetStateAction<number>>
}

const SchemaJson = observer((props: SchemaJsonProp): ReactElement => {
	const { showAdv, showEdit, showExtraLine, setObjectLastItemOffsetTop } = props
	const mobxContext = useContext(SchemaMobxContext)

	return <div>{mapping([], mobxContext.schema, showEdit, showAdv, showExtraLine, setObjectLastItemOffsetTop)}</div>
})

export default SchemaJson
