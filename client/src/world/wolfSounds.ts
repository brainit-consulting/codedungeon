// The sounds that come with the start of something the wolf does, and when (s) into it they come. Keyed on what his
// brain starts, not on the clip, because a sigh or a glance can keep the clip he was already in.
import type { StirKind, WolfAction } from './wolfBrain';

export type WolfSound = { sound: 'sigh' | 'yawn'; at: number };

export function wolfSounds(w: { action: WolfAction; stir: StirKind | null; dur: number }): WolfSound[] {
  if ((w.action === 'stir' && w.stir === 'sigh') || w.action === 'settle') return [{ sound: 'sigh', at: 0 }];
  if (w.action === 'glance') return [{ sound: 'sigh', at: w.dur * 0.6 }]; // as he looks away
  if (w.action === 'stir' && w.stir === 'yawn') return [{ sound: 'yawn', at: w.dur * 0.35 }];
  if (w.action === 'stretch') return [{ sound: 'yawn', at: w.dur * 0.4 }];
  return [];
}
