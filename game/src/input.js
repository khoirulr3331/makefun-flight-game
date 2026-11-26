// input.js — keyboard and mouse state, plus the first-interaction hook
// the browser needs before sound may start.

export function createInput() {
  return {
    keys: new Set(),
    pitch: 0, // -1 (nose down) .. 1 (nose up)
    roll: 0, // -1 (left) .. 1 (right)
    throttleUp: false,
    throttleDown: false,
    brake: false,
    rightDragging: false,
    lastX: 0,
    lastY: 0,
    dragDx: 0,
    dragDy: 0,
    wheelDelta: 0,
    interacted: false,
    pressed: new Set(), // keys pressed since the last poll
  };
}

const PITCH_KEYS = { KeyW: 1, ArrowUp: 1, KeyS: -1, ArrowDown: -1 };
const ROLL_KEYS = { KeyA: -1, ArrowLeft: -1, KeyD: 1, ArrowRight: 1 };

export function attachInput(input, element, onKeyDown) {
  const updateAxes = () => {
    let pitch = 0;
    let roll = 0;
    for (const code of Object.keys(PITCH_KEYS)) {
      if (input.keys.has(code)) pitch += PITCH_KEYS[code];
    }
    for (const code of Object.keys(ROLL_KEYS)) {
      if (input.keys.has(code)) roll += ROLL_KEYS[code];
    }
    input.pitch = Math.max(-1, Math.min(1, pitch));
    input.roll = Math.max(-1, Math.min(1, roll));
    input.throttleUp = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
    input.throttleDown = input.keys.has('ControlLeft') || input.keys.has('ControlRight');
    input.brake = input.keys.has('Space');
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) {
      input.keys.add(e.code);
      input.pressed.add(e.code);
      input.interacted = true;
      updateAxes();
      if (onKeyDown) onKeyDown(e.code, e);
    }
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
    updateAxes();
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    updateAxes();
  });

  element.addEventListener('mousedown', (e) => {
    input.interacted = true;
    if (e.button === 2) {
      input.rightDragging = true;
      input.lastX = e.clientX;
      input.lastY = e.clientY;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 2) input.rightDragging = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!input.rightDragging) return;
    input.dragDx += e.clientX - input.lastX;
    input.dragDy += e.clientY - input.lastY;
    input.lastX = e.clientX;
    input.lastY = e.clientY;
  });
  element.addEventListener('contextmenu', (e) => e.preventDefault());
  element.addEventListener('wheel', (e) => {
    e.preventDefault();
    input.wheelDelta += e.deltaY;
  }, { passive: false });
  element.addEventListener('click', () => { input.interacted = true; });
}

export function consumePress(input, code) {
  if (input.pressed.has(code)) {
    input.pressed.delete(code);
    return true;
  }
  return false;
}

export function clearPresses(input) {
  input.pressed.clear();
}
