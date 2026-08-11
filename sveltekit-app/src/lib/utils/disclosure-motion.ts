import { tick } from "svelte";

const activeAnimations = new WeakMap<HTMLElement, Animation>();

export function measureFirstVisualRow(
	element: HTMLElement,
	itemSelector: string,
): { height: number; count: number } {
	const items = Array.from(element.querySelectorAll<HTMLElement>(itemSelector));
	if (items.length === 0) return { height: 0, count: 0 };

	const containerRect = element.getBoundingClientRect();
	const firstTop = items[0].getBoundingClientRect().top;
	const firstRow = items.filter(
		(item) => Math.abs(item.getBoundingClientRect().top - firstTop) < 1,
	);
	const bottom = Math.max(
		...firstRow.map((item) => item.getBoundingClientRect().bottom),
	);

	return {
		// Unrounded: callers clip to this height and add the surface's closing
		// rule back on top of it. Rounding here lands the clip a fraction of a
		// pixel off the row's own edge, which shows up as a doubled hairline.
		height: bottom - containerRect.top,
		count: firstRow.length,
	};
}

export async function animateDisclosureHeight({
	element,
	nextExpanded,
	collapsedHeight,
	setExpanded,
}: {
	element: HTMLElement | null;
	nextExpanded: boolean;
	collapsedHeight: number;
	setExpanded: (expanded: boolean) => void;
}): Promise<void> {
	if (!element) {
		setExpanded(nextExpanded);
		return;
	}

	const startHeight = element.getBoundingClientRect().height;
	activeAnimations.get(element)?.cancel();
	setExpanded(nextExpanded);
	await tick();

	if (
		typeof window === "undefined" ||
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	) {
		return;
	}

	const endHeight = nextExpanded ? element.scrollHeight : collapsedHeight;
	if (Math.abs(startHeight - endHeight) < 1) return;

	element.style.height = `${startHeight}px`;
	element.style.maxHeight = "none";
	element.style.overflow = "hidden";
	element.style.willChange = "height";

	const animation = element.animate(
		[
			{ height: `${startHeight}px` },
			{ height: `${endHeight}px` },
		],
		{
			duration: nextExpanded ? 220 : 170,
			easing: "cubic-bezier(0.16, 1, 0.3, 1)",
			fill: "both",
		},
	);
	activeAnimations.set(element, animation);

	try {
		await animation.finished;
	} catch {
		// A second click intentionally interrupts the current animation.
	}

	if (activeAnimations.get(element) === animation) {
		activeAnimations.delete(element);
		// A finished animation with `fill: both` otherwise keeps its measured
		// pixel height and clips content that grows after ruby/gloss enrichment.
		animation.cancel();
		element.style.removeProperty("height");
		element.style.removeProperty("max-height");
		element.style.removeProperty("overflow");
		element.style.removeProperty("will-change");
	}
}
