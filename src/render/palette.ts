// The game's entire look lives here. Soft modern pastels, flat shading.

export const PALETTE = {
  sky: 0xdfeef2,

  // terrain
  grassLow: 0xa8d5a2,
  grassHigh: 0x8cc188,
  sand: 0xe8dcb8,
  water: 0x7ec8e3,
  waterDeep: 0x5eb3d6,
  tree: 0x5ea36b,
  treeTrunk: 0x9c7b5a,

  road: 0x5b6570,
  roadLine: 0xe8e6df,

  // zone tints (translucent overlays on empty zoned tiles)
  zoneRes: 0x6fcf7c,
  zoneCom: 0x5da9e9,
  zoneInd: 0xe9c46a,

  // residential buildings by level
  resWall: [0xf2e9dc, 0xefd9c3, 0xe9e4f0] as const,
  resRoof: [0xe76f51, 0xd65f4b, 0x8b7fb8] as const,

  // commercial
  comWall: [0xcfe8f7, 0xaed6f1, 0x9db8d6] as const,
  comRoof: [0x457b9d, 0x33658a, 0x2f4b6e] as const,
  comSign: 0xf4a261,

  // industrial
  indWall: [0xd8c99b, 0xc9b787, 0xb8a878] as const,
  indRoof: [0x8d99ae, 0x7d8a9e, 0x6d7a8e] as const,
  indChimney: 0x9a8c98,

  // services
  power: 0x6d6875,
  powerAccent: 0xffb703,
  police: 0x4361ee,
  policeAccent: 0xe8e6df,
  fireStation: 0xe63946,
  fireAccent: 0xf1faee,
  park: 0x74c69d,
  parkAccent: 0x40916c,
  school: 0xf4a261,
  schoolAccent: 0xfff3e0,

  // states
  abandoned: 0x8a8578,
  rubble: 0x6f6a5d,
  fire: 0xff6b35,
  fireCore: 0xffd166,

  ghostOk: 0x3ddc84,
  ghostBad: 0xff5c5c,
  hover: 0xffffff,
} as const;
