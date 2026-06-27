declare module '@snap-engine/snapsort-svelte' {
	import type { Component } from 'svelte';

	export const ContainerEuclidean: Component<Record<string, unknown>>;
	export const ItemEuclidean: Component<Record<string, unknown>>;
	export const ContainerProgressive: Component<Record<string, unknown>>;
	export const ItemProgressive: Component<Record<string, unknown>>;
	export const Container: Component<Record<string, unknown>>;
	export const Item: Component<Record<string, unknown>>;
}
