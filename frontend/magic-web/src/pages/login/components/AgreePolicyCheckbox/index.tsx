import { AgreePolicyCheckboxUI, type AgreePolicyCheckboxUIProps } from "./AgreePolicyCheckboxUI"

function AgreePolicyCheckbox({
	agree,
	showCheckbox = false,
	onChange,
	className,
	...props
}: AgreePolicyCheckboxUIProps) {
	return (
		<AgreePolicyCheckboxUI
			agree={agree}
			showCheckbox={showCheckbox}
			onChange={onChange}
			className={className}
			{...props}
		/>
	)
}

export default AgreePolicyCheckbox
