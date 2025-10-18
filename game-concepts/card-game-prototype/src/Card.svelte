<script>
  import { Motion } from 'svelte-motion';
  
  let {
    card,
    index = 0,
    totalCards = 1,
    isSelected = false,
    isDragging = false,
    onclick = () => {},
    ondragstart = () => {},
    ondragend = () => {},
    ondrop = () => {}
  } = $props();
  
  let isHovered = $state(false);
  let dragPosition = $state({ x: 0, y: 0 });
  
  // Calculate fan rotation and position
  const maxRotation = 15; // degrees
  const cardSpacing = 80; // pixels between card centers
  
  $effect(() => {
    // This runs when dependencies change
  });
  
  // Calculate the rotation for fan effect
  function getRotation() {
    if (totalCards === 1) return 0;
    const centerIndex = (totalCards - 1) / 2;
    const offset = index - centerIndex;
    return (offset / centerIndex) * maxRotation;
  }
  
  // Calculate horizontal offset
  function getXOffset() {
    if (totalCards === 1) return 0;
    const centerIndex = (totalCards - 1) / 2;
    return (index - centerIndex) * cardSpacing;
  }
  
  // Calculate vertical offset for fan curve
  function getYOffset() {
    if (totalCards === 1) return 0;
    const centerIndex = (totalCards - 1) / 2;
    const offset = index - centerIndex;
    const normalizedOffset = offset / centerIndex;
    return Math.abs(normalizedOffset) * 20; // Curve depth
  }
  
  function handleMouseEnter() {
    isHovered = true;
  }
  
  function handleMouseLeave() {
    isHovered = false;
  }
  
  function handleClick(e) {
    e.stopPropagation();
    onclick();
  }
  
  let isDraggingLocal = $state(false);
  let startPos = $state({ x: 0, y: 0 });
  
  function handleMouseDown(e) {
    isDraggingLocal = true;
    startPos = { x: e.clientX, y: e.clientY };
    ondragstart();
  }
  
  function handleMouseMove(e) {
    if (isDraggingLocal) {
      dragPosition = {
        x: e.clientX - startPos.x,
        y: e.clientY - startPos.y
      };
    }
  }
  
  function handleMouseUp() {
    if (isDraggingLocal) {
      isDraggingLocal = false;
      dragPosition = { x: 0, y: 0 };
      ondragend();
    }
  }
  
  // Add global mouse listeners
  $effect(() => {
    if (isDraggingLocal) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  });
  
  const rotation = getRotation();
  const xOffset = getXOffset();
  const yOffset = getYOffset();
</script>

<Motion
  let:motion
  animate={{
    x: isDraggingLocal ? dragPosition.x : xOffset,
    y: isDraggingLocal ? dragPosition.y : (isHovered || isSelected ? -40 : yOffset),
    rotate: isDraggingLocal ? rotation * 0.5 : rotation,
    scale: isDraggingLocal ? 1.1 : (isHovered || isSelected ? 1.05 : 1),
    zIndex: isDraggingLocal ? 1000 : (isHovered || isSelected ? 100 : index)
  }}
  transition={{
    type: "spring",
    stiffness: isDraggingLocal ? 500 : 300,
    damping: isDraggingLocal ? 30 : 25
  }}
>
  <div
    use:motion
    class="card"
    class:selected={isSelected}
    class:dragging={isDraggingLocal}
    class:hovered={isHovered}
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
    onmousedown={handleMouseDown}
    onclick={handleClick}
    role="button"
    tabindex="0"
  >
    <div class="card-inner">
      <div class="card-face">
        <div class="card-corner top-left">
          <div class="rank" class:red={card.color === 'red'}>{card.rank}</div>
          <div class="suit" class:red={card.color === 'red'}>{card.suit}</div>
        </div>
        
        <div class="card-center">
          <div class="suit-large" class:red={card.color === 'red'}>{card.suit}</div>
        </div>
        
        <div class="card-corner bottom-right">
          <div class="rank" class:red={card.color === 'red'}>{card.rank}</div>
          <div class="suit" class:red={card.color === 'red'}>{card.suit}</div>
        </div>
      </div>
    </div>
  </div>
</Motion>

<style>
  .card {
    position: absolute;
    width: 120px;
    height: 168px;
    cursor: grab;
    user-select: none;
    transform-origin: center bottom;
  }
  
  .card.dragging {
    cursor: grabbing;
  }
  
  .card-inner {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
  }
  
  .card-face {
    width: 100%;
    height: 100%;
    background: white;
    border: 3px solid #333;
    border-radius: 12px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    position: relative;
    transition: box-shadow 0.2s, border-color 0.2s;
  }
  
  .card.hovered .card-face,
  .card.selected .card-face {
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3), 0 0 20px rgba(255, 215, 0, 0.5);
    border-color: #ffd700;
  }
  
  .card.dragging .card-face {
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4), 0 0 30px rgba(255, 215, 0, 0.7);
  }
  
  .card-corner {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  
  .card-corner.top-left {
    top: 8px;
    left: 8px;
  }
  
  .card-corner.bottom-right {
    bottom: 8px;
    right: 8px;
    transform: rotate(180deg);
  }
  
  .rank {
    font-size: 24px;
    font-weight: bold;
    color: black;
    line-height: 1;
  }
  
  .rank.red {
    color: #c41e3a;
  }
  
  .suit {
    font-size: 20px;
    line-height: 1;
    color: black;
  }
  
  .suit.red {
    color: #c41e3a;
  }
  
  .card-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  
  .suit-large {
    font-size: 64px;
    color: black;
    opacity: 0.15;
  }
  
  .suit-large.red {
    color: #c41e3a;
  }
</style>

