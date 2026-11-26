// config.js — every number that tunes Cakrawala Courier in one place.
// Units: metres, seconds, radians. Speeds are m/s internally; the HUD
// converts them to knots and feet for display.

export const CONFIG = {
  world: {
    bounds: 2500, // the chart edge; flying past it turns the plane back
    seaLevel: 0,
    terrainSize: 5200, // terrain mesh spans -2600..2600 on x and z
    terrainSegments: 120,
  },
  sun: {
    // Low warm afternoon sun from the west-southwest.
    direction: [-0.55, 0.38, 0.35],
    color: 0xffd9a0,
    intensity: 1.35,
    ambientColor: 0xffe8c8,
    ambientIntensity: 0.55,
    skyTop: 0x7fb2e0,
    skyHorizon: 0xffd9a0,
    seaColor: 0x2e7fb8,
    fogColor: 0xf2c98f,
    fogNear: 1800,
    fogFar: 5200,
  },
  plane: {
    stallSpeed: 20, // m/s; below this the wing stops flying
    minSpeed: 12,
    maxSpeed: 62, // soft dive limit
    takeoffSpeed: 26,
    climbRate: 9, // m/s at full climb, full throttle
    rollRate: 1.6, // rad/s toward the commanded bank
    maxBank: 1.05, // rad, about 60 degrees
    pitchRate: 0.9,
    maxPitch: 0.55,
    throttleRate: 0.55, // per second while Shift / Control held
    accel: 7.0, // m/s^2 toward the throttle's target speed
    brakeDecel: 14.0, // m/s^2 while the air brake is held
    fuelBurnBase: 0.10, // percent per second at idle
    fuelBurnThrottle: 0.45, // extra percent per second at full throttle
    fuelCapacity: 100,
    damageLimit: 100,
    hardLandingVs: 3.5, // m/s vertical speed that starts to hurt
    crashVs: 6.0, // m/s vertical speed that ends the sortie on land
    landingMaxSpeed: 50,
    landingHeadingTolerance: 0.7, // rad off the strip heading
  },
  camera: {
    distance: 15,
    height: 4.5,
    minDistance: 9,
    maxDistance: 26,
    followLerp: 4.5, // per second
    bankLean: 0.28, // how much the camera rolls with the plane
  },
  rings: {
    radius: 14,
    passRadius: 12.5, // plane must be this close to the centre line
    points: 100,
    centreBonus: 100, // extra points for a dead-centre pass
    timeBonus: 12, // seconds added per ring in Ring Run
  },
  scoring: {
    landingSmooth: 500,
    landingHard: 250,
    legComplete: 400,
    fuelBonusPerPoint: 5, // points per fuel percent left on success
    timeBonusPerSecond: 4,
    comboStep: 0.25, // multiplier grows by this per consecutive ring
    comboMax: 3,
    hardLandingPenalty: 150,
  },
  wind: {
    // A light steady breeze from the north-west, pushing the nose sideways.
    x: 2.0,
    z: 1.2,
    gustStrength: 9, // Storm Run gusts, m/s
    gustPeriod: 3.5, // seconds between gust peaks
  },
};

// Islands of the archipelago. x and z are metres, radius the island's
// footprint, peak its height above the sea. Pulau Api is the tall volcano.
export const ISLANDS = [
  { name: 'Pulau Merak', x: 0, z: 260, radius: 800, peak: 130 },
  { name: 'Pulau Kenanga', x: 1150, z: -650, radius: 480, peak: 72 },
  { name: 'Pulau Cendana', x: -950, z: -1050, radius: 400, peak: 60 },
  { name: 'Pulau Melati', x: -1350, z: 750, radius: 430, peak: 78 },
  { name: 'Pulau Kamboja', x: 950, z: 1150, radius: 420, peak: 66 },
  { name: 'Pulau Seroja', x: 1850, z: 350, radius: 400, peak: 55 },
  { name: 'Pulau Api', x: -450, z: 1750, radius: 520, peak: 280 },
];

// Flat patches carved into the terrain so the strips sit on level ground.
// Kenanga and Seroja get a wide shelf (radius 320): their strips sit on
// island slopes, and a narrow flat left a ridge across the final approach
// that forced a steep dive onto the strip. The home field's approach is
// over the sea, so its radius stays 300.
export const FLATS = [
  { x: 0, z: -320, radius: 300, height: 2 }, // home field, Pulau Merak
  { x: 1150, z: -500, radius: 320, height: 2 }, // Kenanga strip
  { x: 1850, z: 350, radius: 320, height: 2 }, // Seroja strip
];

// Runway strips. heading is radians, 0 = east (+x), positive turns left.
export const RUNWAYS = {
  home: {
    name: 'Pulau Merak',
    x: 0, z: -320, heading: 0, length: 340, width: 26, paved: true,
  },
  kenanga: {
    name: 'Pulau Kenanga',
    x: 1150, z: -500, heading: Math.PI / 2, length: 240, width: 22, paved: false,
  },
  seroja: {
    name: 'Pulau Seroja',
    x: 1850, z: 350, heading: 0, length: 240, width: 22, paved: false,
  },
};

// Ring Run route: eight hoops around Pulau Merak and Pulau Kenanga.
// Each ring faces the direction of travel from the previous one.
export const RING_RUN_ROUTE = [
  { x: 450, y: 90, z: -280 },
  { x: 900, y: 110, z: -450 },
  { x: 1150, y: 130, z: -650 },
  { x: 900, y: 140, z: -1000 },
  { x: 300, y: 120, z: -900 },
  { x: -350, y: 130, z: -600 },
  { x: -700, y: 110, z: -150 },
  // Ring 8 sits over Pulau Merak's southern slope: the hillside there
  // rises to about 117 m, so this hoop flies at 150 m to stay clear.
  { x: -200, y: 150, z: 250 },
];

// Storm Run flies a shorter, harder version of the same route.
export const STORM_RUN_ROUTE = [
  RING_RUN_ROUTE[0],
  RING_RUN_ROUTE[2],
  RING_RUN_ROUTE[3],
  RING_RUN_ROUTE[5],
  RING_RUN_ROUTE[7],
];
