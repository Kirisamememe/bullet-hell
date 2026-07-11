/**
 * BGM note data for the chiptune sequencer in MusicManager. Each track loops
 * forever; every channel's event durations must sum to `totalSteps` (16th
 * notes) so the four channels stay locked in sync across loop boundaries.
 */

import { noteFreq as nf } from './chip';
import type { ChannelPattern, DrumHit, NoteEvent, Track } from './MusicManager';

/** One bar (16 sixteenth-note steps) of driving kick/hat groove, reused across the whole loop. */
function drumBar(pattern: (DrumHit | null)[]): NoteEvent[] {
  return pattern.map((hit) => [hit, 1] as NoteEvent);
}

// ---------------------------------------------------------------------------
// TITLE THEME — calm, heroic, C major. 110 BPM, 4 bars (64 steps).
// ---------------------------------------------------------------------------

const titleBass: NoteEvent[] = [
  [nf('C3'), 16],
  [nf('A3'), 16],
  [nf('F3'), 16],
  [nf('G3'), 16],
];

const titleLead: NoteEvent[] = [
  [nf('E5'), 4], [nf('G5'), 4], [nf('A5'), 4], [nf('G5'), 4],
  [nf('F5'), 4], [nf('A5'), 4], [nf('G5'), 4], [nf('E5'), 4],
  [nf('D5'), 4], [nf('F5'), 4], [nf('E5'), 4], [nf('C5'), 4],
  [nf('D5'), 4], [nf('E5'), 4], [nf('G5'), 4], [nf('C5'), 4],
];

const titleHarmony: NoteEvent[] = [
  [null, 4], [nf('G4'), 4], [null, 4], [nf('C5'), 4],
  [null, 4], [nf('E4'), 4], [null, 4], [nf('A4'), 4],
  [null, 4], [nf('A4'), 4], [null, 4], [nf('F4'), 4],
  [null, 4], [nf('B4'), 4], [null, 4], [nf('G4'), 4],
];

const titleDrums: NoteEvent[] = [
  ...drumBar(['kick', null, null, null, null, null, null, null, 'hat', null, null, null, null, null, null, null]),
  ...drumBar(['kick', null, null, null, null, null, null, null, 'hat', null, null, null, null, null, null, null]),
  ...drumBar(['kick', null, null, null, null, null, null, null, 'hat', null, null, null, null, null, null, null]),
  ...drumBar(['kick', null, null, null, null, null, null, null, 'hat', null, null, null, null, null, 'accent', null]),
];

export const TITLE_TRACK: Track = {
  bpm: 110,
  totalSteps: 64,
  channels: [
    { wave: 'pulse', duty: 0.25, gain: 0.16, events: titleLead },
    { wave: 'pulse', duty: 0.5, gain: 0.08, events: titleHarmony },
    { wave: 'triangle', gain: 0.15, events: titleBass },
    { wave: 'noise', gain: 0.12, events: titleDrums },
  ],
};

// ---------------------------------------------------------------------------
// STAGE THEME — driving, E natural minor. 150 BPM, 4 bars (64 steps).
// ---------------------------------------------------------------------------

const stageBassBarA: NoteEvent[] = [[nf('E3'), 4], [nf('E3'), 4], [nf('G3'), 4], [nf('A3'), 4]];
const stageBassBarB: NoteEvent[] = [[nf('D3'), 4], [nf('D3'), 4], [nf('C3'), 4], [nf('B2'), 4]];
const stageBass: NoteEvent[] = [...stageBassBarA, ...stageBassBarA, ...stageBassBarA, ...stageBassBarB];

const stageLeadBarA: NoteEvent[] = [
  [nf('E5'), 2], [nf('G5'), 2], [nf('B5'), 2], [nf('A5'), 2],
  [nf('G5'), 2], [nf('E5'), 2], [nf('D5'), 2], [nf('B4'), 2],
];
const stageLeadBarB: NoteEvent[] = [
  [nf('D5'), 2], [nf('C5'), 2], [nf('B4'), 2], [nf('A4'), 2],
  [nf('G4'), 2], [nf('F#4'), 2], [nf('E4'), 2], [nf('B4'), 2],
];
const stageLead: NoteEvent[] = [...stageLeadBarA, ...stageLeadBarA, ...stageLeadBarB, ...stageLeadBarB];

const stageHarmonyBarA: NoteEvent[] = [
  [null, 2], [nf('B4'), 2], [null, 2], [nf('B4'), 2],
  [null, 2], [nf('G4'), 2], [null, 2], [nf('G4'), 2],
];
const stageHarmonyBarB: NoteEvent[] = [
  [null, 2], [nf('A4'), 2], [null, 2], [nf('A4'), 2],
  [null, 2], [nf('F#4'), 2], [null, 2], [nf('F#4'), 2],
];
const stageHarmony: NoteEvent[] = [...stageHarmonyBarA, ...stageHarmonyBarA, ...stageHarmonyBarB, ...stageHarmonyBarB];

const stageDrumBar = drumBar([
  'kick', null, 'hat', null,
  'kick', null, 'hat', null,
  'kick', null, 'hat', null,
  'kick', 'hat', 'hat', 'accent',
]);
const stageDrums: NoteEvent[] = [...stageDrumBar, ...stageDrumBar, ...stageDrumBar, ...stageDrumBar];

export const STAGE_TRACK: Track = {
  bpm: 150,
  totalSteps: 64,
  channels: [
    { wave: 'pulse', duty: 0.25, gain: 0.15, events: stageLead },
    { wave: 'pulse', duty: 0.5, gain: 0.09, events: stageHarmony },
    { wave: 'triangle', gain: 0.15, events: stageBass },
    { wave: 'noise', gain: 0.13, events: stageDrums },
  ],
};

// ---------------------------------------------------------------------------
// BOSS THEME — tense, E Phrygian. 172 BPM, 4 bars (64 steps).
// ---------------------------------------------------------------------------

const bossBassBarA: NoteEvent[] = [[nf('E3'), 2], [nf('F3'), 2], [nf('E3'), 2], [nf('F3'), 2], [nf('E3'), 4], [nf('D3'), 4]];
const bossBassBarB: NoteEvent[] = [[nf('C3'), 4], [nf('B2'), 4], [nf('E3'), 4], [nf('E3'), 4]];
const bossBass: NoteEvent[] = [...bossBassBarA, ...bossBassBarA, ...bossBassBarA, ...bossBassBarB];

const bossLeadBarA: NoteEvent[] = [
  [nf('E5'), 2], [nf('F5'), 2], [nf('G5'), 2], [nf('B5'), 2],
  [nf('C6'), 2], [nf('B5'), 2], [nf('G5'), 2], [nf('F5'), 2],
];
const bossLeadBarB: NoteEvent[] = [
  [nf('E5'), 1], [nf('F5'), 1], [nf('E5'), 1], [nf('F5'), 1],
  [nf('G5'), 1], [nf('F5'), 1], [nf('E5'), 1], [nf('D5'), 1],
  [nf('C5'), 1], [nf('B4'), 1], [nf('C5'), 1], [nf('D5'), 1],
  [nf('E5'), 1], [nf('F5'), 1], [nf('G5'), 1], [nf('B5'), 1],
];
const bossLead: NoteEvent[] = [...bossLeadBarA, ...bossLeadBarA, ...bossLeadBarA, ...bossLeadBarB];

const bossHarmonyBarA: NoteEvent[] = [
  [null, 2], [nf('F4'), 2], [null, 2], [nf('F4'), 2],
  [null, 2], [nf('C4'), 2], [null, 2], [nf('C4'), 2],
];
const bossHarmonyBarB: NoteEvent[] = [
  [nf('F4'), 1], [null, 1], [nf('F4'), 1], [null, 1],
  [nf('C4'), 1], [null, 1], [nf('C4'), 1], [null, 1],
  [nf('G4'), 1], [null, 1], [nf('G4'), 1], [null, 1],
  [nf('B4'), 1], [null, 1], [nf('B4'), 1], [null, 1],
];
const bossHarmony: NoteEvent[] = [...bossHarmonyBarA, ...bossHarmonyBarA, ...bossHarmonyBarA, ...bossHarmonyBarB];

const bossDrumBar = drumBar([
  'kick', 'hat', 'kick', 'hat',
  'kick', 'hat', 'accent', 'hat',
  'kick', 'hat', 'kick', 'hat',
  'kick', 'accent', 'hat', 'accent',
]);
const bossDrums: NoteEvent[] = [...bossDrumBar, ...bossDrumBar, ...bossDrumBar, ...bossDrumBar];

export const BOSS_TRACK: Track = {
  bpm: 172,
  totalSteps: 64,
  channels: [
    { wave: 'pulse', duty: 0.25, gain: 0.16, events: bossLead },
    { wave: 'pulse', duty: 0.5, gain: 0.1, events: bossHarmony },
    { wave: 'triangle', gain: 0.16, events: bossBass },
    { wave: 'noise', gain: 0.14, events: bossDrums },
  ],
};

/** Sanity-checks that every channel's event durations sum to totalSteps (dev-time assertion). */
function assertTrack(name: string, track: Track): void {
  for (const chan of track.channels as ChannelPattern[]) {
    const sum = chan.events.reduce((acc, [, steps]) => acc + steps, 0);
    if (sum !== track.totalSteps) {
      console.warn(`[tracks] ${name}: channel sums to ${sum} steps, expected ${track.totalSteps}`);
    }
  }
}

assertTrack('title', TITLE_TRACK);
assertTrack('stage', STAGE_TRACK);
assertTrack('boss', BOSS_TRACK);
