declare module '@snap-engine/snapsort' {
	export type ItemId = string;

	export interface ItemMetadata extends Record<string, unknown> {
		itemId?: ItemId;
	}

	export interface AnimationConfig {
		timing_function?: string;
		duration?: number;
	}

	export interface ContainerAnimations {
		reorder?: AnimationConfig | null;
		drop?: AnimationConfig | null;
		clickMove?: AnimationConfig | null;
	}

	export interface SnapSortDomRemoveEvent {
		item: ItemBase;
		itemMetadata: ItemMetadata;
		container: ContainerBase;
		containerMetadata: Record<string, unknown>;
	}

	export interface SnapSortDomInsertEvent {
		item: ItemBase;
		itemMetadata: ItemMetadata;
		container: ContainerBase;
		containerMetadata: Record<string, unknown>;
		index: number;
		beforeElement: HTMLElement | null;
	}

	export interface ContainerCallbacks {
		onDomRemove?: (event: SnapSortDomRemoveEvent) => void;
		onDomInsert?: (event: SnapSortDomInsertEvent) => void;
		afterDomMutation?: () => void | Promise<void>;
	}

	export interface ContainerConfig {
		groupID?: string;
		direction?: 'column' | 'row';
		mainAxisAlign?: LayoutMainAxisAlign;
		name?: string;
		animation?: ContainerAnimations | null;
		disableFlip?: boolean;
		noDrop?: boolean;
		dropArea?: boolean;
		callbacks?: ContainerCallbacks;
	}

	export type LayoutMainAxisAlign = 'start' | 'center' | 'end' | 'space-between';

	export class ItemBase {
		id: string;
		element: HTMLElement | null;
		metadata: ItemMetadata;
	}

	export class ItemEuclidean extends ItemBase {}
	export class ItemProgressive extends ItemBase {}
	export const Item: typeof ItemEuclidean;

	export class ContainerBase extends ItemBase {
		readonly numberOfItems: number;
		moveItem(id: ItemId, container: ContainerBase, index: number): boolean;
		removeItem(id: ItemId): void;
	}

	export class ContainerEuclidean extends ContainerBase {}
	export class ContainerProgressive extends ContainerBase {}
	export const Container: typeof ContainerEuclidean;
}
