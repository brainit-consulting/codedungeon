import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { loadView, pendingRequests, saveView, unreadMessages, useStore, type Focus } from '../store';
import { api } from '../api';
import { inDungeon, roomAt, visitSpot } from './dungeon';
import { EYE_HEIGHT, SPAWN, collide, type Rect } from './layout';
import { interactables } from './interact';
import { LOOK_RADIANS_PER_PX, createLookFilter, filterLookDelta, lookScale, nextZoom, resetLookFilter, useLookPrefs, zoomedFov } from './look';
import { confirmDialog, isConfirmOpen } from '../ui/Confirm';
import { footstepsFollow, getAudioPrefs, toggleMusic, toggleMute } from '../ui/sfx';
import { callTheCat } from './Cat';
import { collectDarts, dropHeld, startCharge, throwHeld } from './toys/hands';
import { watchLookLock } from './lookLock';
import { fallsBackToDrag, hushesAfterUse, lockAllowed, viewPointer } from './lookLockRules';
import { pokeToy } from './toys/poke';
import { auditProps, verdict } from './propAudit';

let canvasEl: HTMLCanvasElement | null = null;
// Set once the mouse has been captured on this page: the browser can do it, so a later refusal is only its pause after Esc.
let everLocked = false;
// The spyglass: the wheel sets the target, each frame eases the camera's field of view toward it.
const zoom = { target: 1, now: 1 };

// After a click on the world (not E: see hushesAfterUse), mouse presses are swallowed for a moment, so the second
// half of a double click can't land on the panel's backdrop and close it, or confirm a hire.
const QUIET_MS = 400;
let quietUntil = 0;
const QUIET_EVENTS = ['mousedown', 'mouseup', 'click', 'dblclick'] as const;
const hushMouse = () => {
  quietUntil = performance.now() + QUIET_MS;
};

/** Grab the mouse for looking around. Must be called from a click handler. */
export function requestLook() {
  const s = useStore.getState();
  if (!canvasEl || !lockAllowed({ started: s.started, overlay: !!s.overlay, confirm: isConfirmOpen(), focused: document.hasFocus() })) return;
  const el = canvasEl;
  if (s.dragLook) return;
  // No capture after a moment, on a page that has never had one (the browser refused without saying so): look by dragging.
  setTimeout(() => {
    if (document.pointerLockElement !== el && fallsBackToDrag(everLocked)) useStore.getState().setDragLook(true);
  }, 600);
  // Raw (unadjusted) input skips the OS mouse path that produces bogus spikes on Windows.
  // Browsers that can't do it reject with NotSupportedError (Firefox ignores the option).
  lockPointer(el, { unadjustedMovement: true })?.catch?.((err: unknown) => {
    if (err instanceof DOMException && err.name === 'NotSupportedError') lockPointer(el)?.catch?.(() => undefined);
    // refused outright (e.g. the browser panel inside the Claude app disables pointer lock): drag to look at once
    // (after Esc, Chrome and Edge refuse with the same error for about a second; then the next click captures it)
    else if (err instanceof DOMException && err.name === 'SecurityError' && fallsBackToDrag(everLocked)) useStore.getState().setDragLook(true);
  });
}

function lockPointer(el: HTMLCanvasElement, options?: PointerLockOptions): Promise<void> | undefined {
  try {
    return el.requestPointerLock?.(options);
  } catch {
    return undefined; // older browsers throw instead of rejecting
  }
}

/** Spike counters, readable from the console as __swarmLook. */
const lookDiag = { dropped: 0, skipped: 0 };
(window as unknown as Record<string, unknown>).__swarmLook = lookDiag;

export function runFocusAction(focus: Focus, via: 'key' | 'click' = 'key') {
  const s = useStore.getState();
  if (hushesAfterUse(via)) quietUntil = performance.now() + QUIET_MS;
  if (focus.action.kind === 'pickup') {
    collectDarts(); // the dart board: every dart comes back into your hand
    return;
  }
  if (focus.action.kind === 'poke') {
    pokeToy(focus.action.toyId);
    return;
  }
  if (focus.action.kind === 'hire') {
    const { repoId, role } = focus.action;
    const hire = () =>
      api
        .hireAgent(repoId, { role })
        .then(() => s.pushToast('success', role === 'qa' ? 'New tester recruited. They will take the next free testing bench in the assay room.' : 'New coder recruited. They will sit at the next free bench.'))
        .catch(() => undefined);
    if (via === 'key') {
      void hire();
      return;
    }
    // A click is easier to make by accident than E, so hiring by click asks first.
    if (document.pointerLockElement) document.exitPointerLock();
    void confirmDialog({
      icon: role === 'qa' ? '🔍' : '🪑',
      title: role === 'qa' ? 'Recruit a tester for this testing bench?' : 'Recruit a coder for this bench?',
      confirm: 'Recruit',
    }).then((ok) => {
      if (ok) void hire();
    });
    return;
  }
  s.openOverlay(focus.action);
}

const isTyping = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

export function Player({ colliders, slots }: { colliders: Rect[]; slots: number[] }) {
  const { camera, gl, scene } = useThree();
  const keys = useRef(new Set<string>());
  const look = useRef({ yaw: SPAWN.yaw, pitch: -0.05 });
  const bob = useRef(0);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const center = useMemo(() => new THREE.Vector2(0, 0), []);
  const frame = useRef(0);
  const lookFilter = useMemo(createLookFilter, []);
  const baseFov = useRef((camera as THREE.PerspectiveCamera).fov);

  // After a page reload, return to the remembered spot if it is still somewhere you can stand; otherwise the hall.
  // Wait for the server's first list of projects: until then no chamber exists, and a spot in one would look invalid.
  const loaded = useStore((s) => s.loaded);
  const restored = useRef(false);
  useEffect(() => {
    if (!loaded || restored.current) return;
    restored.current = true;
    const saved = loadView();
    const p = saved && collide(saved.x, saved.z, colliders);
    if (saved && p && Math.hypot(p.x - saved.x, p.z - saved.z) < 0.01 && inDungeon(saved.x, saved.z, slots)) {
      camera.position.set(saved.x, EYE_HEIGHT, saved.z);
      look.current = { yaw: saved.yaw, pitch: saved.pitch };
      return;
    }
    camera.position.set(SPAWN.x, EYE_HEIGHT, SPAWN.z);
    look.current = { yaw: SPAWN.yaw, pitch: -0.05 };
    // only once: later the player walks, or is sent by a visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, loaded]);

  // A walk-in (the directory, a "Visit" button): straight to just inside that chamber's door, or back to the hall.
  const visit = useStore((s) => s.visit);
  useEffect(() => {
    if (!visit) return;
    const to = visit.to && slots.includes(visit.to) ? visitSpot(visit.to) : SPAWN;
    camera.position.set(to.x, EYE_HEIGHT, to.z);
    look.current = { yaw: to.yaw, pitch: -0.05 };
    useStore.getState().clearVisit();
  }, [visit, slots, camera]);
  const lastSave = useRef(0);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // Dev helper for inspecting views without pointer lock: __swarmCam(x, z, yawDeg, pitchDeg)
    (window as unknown as Record<string, unknown>).__swarmCam = (x: number, z: number, yawDeg = 0, pitchDeg = 0) => {
      camera.position.set(x, EYE_HEIGHT, z);
      look.current = { yaw: (yawDeg * Math.PI) / 180, pitch: (pitchDeg * Math.PI) / 180 };
    };
    // and a check that no placed prop floats or sinks: __propAudit() lists the ones that do (propAudit.ts)
    (window as unknown as Record<string, unknown>).__propAudit = () => auditProps(scene).filter((p) => verdict(p.gap) !== 'ok');
    // and what's under a point of the screen (x, y from -1 to 1): every mesh along that line, nearest first
    (window as unknown as Record<string, unknown>).__pick = (x: number, y: number) => {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(x, y), camera);
      return ray.intersectObjects(scene.children, true).slice(0, 6).map((h) => {
        const b = new THREE.Box3().setFromObject(h.object);
        const chain: string[] = [];
        for (let o: THREE.Object3D | null = h.object; o && chain.length < 5; o = o.parent) chain.push(o.userData.model ?? o.name ?? o.type);
        return { at: h.distance.toFixed(3), chain: chain.join(' < '), min: b.min.toArray().map((v) => +v.toFixed(3)), max: b.max.toArray().map((v) => +v.toFixed(3)) };
      });
    };
  }, [camera, scene]);

  useEffect(() => {
    canvasEl = gl.domElement;
    // Left button only. If the mouse is already captured, use what you're holding (winding up a throw until
    // the button comes up) or, empty-handed, act on the crosshair's target (like E). Otherwise this press
    // just captures the mouse, so the click that locks never also acts.
    // Drag-to-look (when the mouse can't be captured): a drag turns the view, a click without a drag acts.
    const drag = { down: false, moved: 0 };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault(); // the middle button puts the spyglass down (and doesn't start the browser's autoscroll)
        zoom.target = 1;
        return;
      }
      if (e.button !== 0) return;
      if (useStore.getState().dragLook) {
        drag.down = true;
        drag.moved = 0;
        return;
      }
      if (document.pointerLockElement !== gl.domElement) return requestLook();
      const s = useStore.getState();
      if (!s.started || s.overlay || isConfirmOpen()) return;
      if (s.held) startCharge();
      else if (s.focus) runFocusAction(s.focus, 'click');
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const s = useStore.getState();
      if (s.dragLook) {
        const wasDrag = drag.moved > 6;
        drag.down = false;
        if (wasDrag || !s.started || s.overlay || isConfirmOpen() || e.target !== gl.domElement) return;
        if (s.held) {
          startCharge();
          throwHeld();
        } else if (s.focus) runFocusAction(s.focus, 'click');
        return;
      }
      throwHeld();
    };
    const onQuietMouse = (e: MouseEvent) => {
      if (performance.now() >= quietUntil) return;
      e.stopPropagation();
      e.preventDefault();
    };
    const onLockChange = () => {
      resetLookFilter(lookFilter);
      const locked = document.pointerLockElement === gl.domElement;
      const s = useStore.getState();
      if (locked && !lockAllowed({ started: s.started, overlay: !!s.overlay, confirm: isConfirmOpen(), focused: document.hasFocus() })) {
        document.exitPointerLock(); // a capture at the wrong moment (lockAllowed): let go before it can freeze the arrow
        return;
      }
      if (locked) everLocked = true;
      if (!locked) dropHeld(); // Esc: you've stepped away, so the darts go back on the ledge
      useStore.getState().setLocked(locked);
    };
    const onMove = (e: MouseEvent) => {
      if (useStore.getState().dragLook) {
        if (!drag.down || useStore.getState().overlay) return;
        drag.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
        const { sensitivity, invertY } = useLookPrefs.getState();
        const k = LOOK_RADIANS_PER_PX * sensitivity * 1.6 * lookScale(zoom.now); // a drag covers less ground than a captured mouse
        look.current.yaw -= e.movementX * k; // turn the way you drag, as a captured mouse does
        look.current.pitch = Math.max(-1.35, Math.min(1.35, look.current.pitch - e.movementY * k * (invertY ? -1 : 1)));
        return;
      }
      if (document.pointerLockElement !== gl.domElement || !document.hasFocus()) return;
      const d = filterLookDelta(lookFilter, e.movementX, e.movementY, e.timeStamp);
      lookDiag.dropped = lookFilter.dropped;
      lookDiag.skipped = lookFilter.skipped;
      if (!d) return;
      const { sensitivity, invertY } = useLookPrefs.getState();
      const k = LOOK_RADIANS_PER_PX * sensitivity * lookScale(zoom.now);
      look.current.yaw -= d[0] * k;
      look.current.pitch = Math.max(-1.35, Math.min(1.35, look.current.pitch - d[1] * k * (invertY ? -1 : 1)));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const s = useStore.getState();
      if (e.code === 'KeyM' && !e.repeat && !isConfirmOpen()) {
        toggleMute();
        s.pushToast('info', getAudioPrefs().muted ? '🔇 Sound off (M to turn it back on)' : '🔊 Sound on');
      }
      if (e.code === 'KeyN' && !e.repeat && !isConfirmOpen()) {
        toggleMusic();
        const p = getAudioPrefs();
        s.pushToast('info', p.musicOn ? (p.muted ? '🎵 Music on, but all sound is off (M)' : '🎵 Music on') : '🎵 Music off (N to bring it back)');
      }
      if (s.overlay || !s.started || isConfirmOpen()) return;
      keys.current.add(e.code);
      // E always acts on the crosshair's target, even with darts in hand (a panel opening puts them back on the ledge).
      if (e.code === 'KeyE' && !e.repeat && s.focus) runFocusAction(s.focus);
      if (e.code === 'KeyF' && !e.repeat) startCharge();
      if (e.code === 'KeyG' && !e.repeat) dropHeld();
      if (e.code === 'KeyC' && !e.repeat) callTheCat();
      if (e.code === 'KeyH') s.openOverlay({ kind: 'help' });
      if (e.code === 'KeyB' && !e.repeat) s.openOverlay({ kind: 'guide' });
      if (e.code === 'KeyP') {
        e.preventDefault(); // don't type the "p" into the phone's message box
        s.openOverlay({ kind: 'phone', tab: pendingRequests(s.requests).length && !unreadMessages(s.messages, s.phoneReadAt) ? 'hires' : 'chat' });
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current.delete(e.code);
      if (e.code === 'KeyF') throwHeld();
    };
    const onBlur = () => {
      keys.current.clear();
      useStore.getState().setCharge(null); // the button's release would be missed
    };
    const onWheel = (e: WheelEvent) => {
      const s = useStore.getState();
      if (!s.started || s.overlay || isConfirmOpen()) return;
      e.preventDefault();
      zoom.target = nextZoom(zoom.target, e.deltaY);
    };
    // One pointer at a time: while looking by dragging, the arrow is hidden over the view and the crosshair aims.
    const showPointer = () => {
      const s = useStore.getState();
      gl.domElement.style.cursor = viewPointer({ started: s.started, overlay: !!s.overlay, locked: s.locked, dragLook: s.dragLook }).hideArrow ? 'none' : '';
    };
    showPointer();
    const offPointer = useStore.subscribe(showPointer);
    gl.domElement.addEventListener('wheel', onWheel, { passive: false });
    gl.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    for (const type of QUIET_EVENTS) window.addEventListener(type, onQuietMouse, true);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    const stopLookLock = watchLookLock(requestLook, hushMouse);
    return () => {
      stopLookLock();
      offPointer();
      gl.domElement.removeEventListener('wheel', onWheel);
      gl.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      for (const type of QUIET_EVENTS) window.removeEventListener(type, onQuietMouse, true);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [gl, lookFilter]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = useStore.getState();
    if (s.overlay || isConfirmOpen()) keys.current.clear();
    if (s.overlay) zoom.target = 1; // a panel puts the spyglass down: you come back to the normal view

    // the spyglass: ease toward the wheel's zoom
    if (zoom.now !== zoom.target) {
      zoom.now += (zoom.target - zoom.now) * Math.min(1, dt * 12);
      if (Math.abs(zoom.now - zoom.target) < 0.002) zoom.now = zoom.target;
      const cam = camera as THREE.PerspectiveCamera;
      cam.fov = zoomedFov(baseFov.current, zoom.now);
      cam.updateProjectionMatrix();
    }

    // movement
    const k = keys.current;
    const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const strafe = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? 6.5 : 3.6;
    const { yaw, pitch } = look.current;
    let moving = false;
    if (fwd || strafe) {
      const len = Math.hypot(fwd, strafe);
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      const dx = ((-sin * fwd + cos * strafe) / len) * speed * dt;
      const dz = ((-cos * fwd - sin * strafe) / len) * speed * dt;
      const p = collide(camera.position.x + dx, camera.position.z + dz, colliders);
      camera.position.x = p.x;
      camera.position.z = p.z;
      moving = true;
    }
    bob.current += moving ? dt * speed * 2.2 : 0;
    camera.position.y = EYE_HEIGHT + (moving ? Math.sin(bob.current) * 0.035 : 0);
    footstepsFollow(bob.current, moving, speed > 5);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');

    const now = performance.now();
    if (++frame.current % 10 === 0) s.setFloor(roomAt(camera.position.x, camera.position.z, slots));
    if (s.started && restored.current && now - lastSave.current > 1000) {
      lastSave.current = now;
      saveView({ x: camera.position.x, z: camera.position.z, yaw, pitch });
    }

    // what are we looking at?
    if (frame.current % 3 !== 0) return;
    if (s.overlay || isConfirmOpen()) {
      if (s.focus) s.setFocus(null);
      return;
    }
    ray.setFromCamera(center, camera);
    ray.far = 8;
    const roots = [...interactables.keys()];
    const hits = ray.intersectObjects(roots, true);
    let found: Focus | null = null;
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !interactables.has(o)) o = o.parent;
      if (!o) continue;
      const info = interactables.get(o)!;
      if (h.distance <= info.range) found = { id: info.id, label: info.label, action: info.action };
      break;
    }
    s.setFocus(found);
  });

  return null;
}
