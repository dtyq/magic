export interface MobileDeleteConfirmPopupProps {
	/** Whether the bottom sheet is visible */
	visible: boolean
	/** Close handler for cancel and backdrop dismiss */
	onClose: () => void
	/** Header title, e.g. "Delete project" */
	title: string
	/** Entity name shown in bold in the body */
	entityName: string
	/** Consequence text after the entity name (without the name prefix) */
	descriptionSuffix: string
	/** Called when the user taps the destructive confirm action */
	onConfirm: () => void | Promise<void>
	/** Disables confirm while a delete request is in flight */
	confirmDisabled?: boolean
	/** Prefix for data-testid on popup and actions */
	testIdPrefix?: string
	/** Accessible label for the leading cancel control */
	cancelAriaLabel: string
	/** Accessible label for the trailing confirm control */
	confirmAriaLabel: string
}
