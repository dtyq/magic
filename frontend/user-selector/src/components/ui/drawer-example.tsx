import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer"

// Example usage component
export function DrawerExample() {
	return (
		<Drawer>
			<DrawerTrigger asChild>
				<button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
					Open Drawer
				</button>
			</DrawerTrigger>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>Are you absolutely sure?</DrawerTitle>
					<DrawerDescription>
						This action cannot be undone. This will permanently delete your account and
						remove your data from our servers.
					</DrawerDescription>
				</DrawerHeader>
				<DrawerFooter>
					<button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
						Submit
					</button>
					<DrawerClose asChild>
						<button className="rounded-md border border-border px-4 py-2">
							Cancel
						</button>
					</DrawerClose>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	)
}
