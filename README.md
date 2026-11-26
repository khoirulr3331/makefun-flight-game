# Cakrawala Courier

[![Best flight game](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/khoirulr3331/makefun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/khoirulr3331/makefun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A 3D island-hopping courier flight game in a desktop browser, built with
Three.js. Fly a small single-prop courier plane in chase view over a
tropical archipelago at golden hour: take off from the home runway on
Pulau Merak, thread glowing golden rings over the islands, deliver parcels
to grass strips, and land before your fuel runs out.

Three sorties: **Ring Run** (eight rings against the clock, combo
multiplier), **Island Hop** (parcel deliveries to two grass strips and
home), and **Storm Run** (the ring route in gusty wind, double points).
Fuel burn, damage, stall, wind and a soft dive limit turn every sortie
into decisions. The HUD shows altitude, vertical speed, an attitude
indicator, a heading tape with destination bearing, airspeed, throttle,
fuel, wind, the objective, score, combo and the clock. All sound is
synthesised in the browser with the Web Audio API — no audio files, no
network at all.

## How to run

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. Or serve `game/`
with any static server and open `game/index.html`.

## Controls

W/S or ↑/↓ pitch · A/D or ←/→ bank & turn · Shift throttle up ·
Ctrl throttle down · Space air brake · Right-drag glance · Wheel zoom ·
Enter start · P pause · R restart · M mute
