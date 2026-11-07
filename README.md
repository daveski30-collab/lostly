# Lostly 🔑👛⌚🧥

**Never leave your stuff behind.** Lostly nudges you when you leave a place, and only when it actually matters.

Idea by Will. Built with Expo (React Native), so one codebase runs on iPhone, Android, and the web.

## How the smart nudges work

Every rule is a reason *not* to bother you. If none apply, you get a nudge.

| Rule | What it stops |
|---|---|
| **Leave distance** (100 to 1000 m) | False alarms from GPS wobble |
| **Only if I stayed at least X min** | Nudges when you just drive past |
| **Quiet time after a nudge** | Getting nudged over and over |
| **Skip if I checked within X min** | Nudges right after you already checked |
| **Active days / hours** | School nudges on Saturday, gym nudges at midnight |
| **Day-specific items** | Gym bag only shows on Tue/Thu |

Lostly also learns: items you forget most move to the top, and the nudge calls them out ("you have left your wallet here 3 times").

All of this lives in [`src/lib/rules.ts`](src/lib/rules.ts) with tests in [`src/lib/rules.test.ts`](src/lib/rules.test.ts).

## Project map

```
src/
  app/                 screens (Expo Router: each file is a screen)
    index.tsx          home: your places, "Try leaving", activity log
    place/[id].tsx     add/edit a place, checklist, and rules
    check/[id].tsx     the "Got everything?" checklist
  lib/
    rules.ts           the smart nudge brain (pure logic, tested)
    engine.ts          connects location events to the rules
    store.ts           saves data on the device (nothing leaves the phone)
    platform.native.ts phone: background geofencing + notifications
    platform.ts        web: preview mode (browsers cannot track you in the background)
  components/ui.tsx    buttons, steppers, day pickers
```

## Run it

```bash
npm install
npm run web        # try it in the browser
npm start          # then scan the QR code with the Expo Go app
npm test           # run the rules tests
```

**Heads up:** background location does not work in Expo Go on iPhone. To test real nudges on a phone, make a development build:

```bash
npx expo install expo-dev-client
npx eas build --profile development --platform ios   # or android
```

## Ideas for next versions

- Wi-Fi disconnect or car Bluetooth as faster "I am leaving" signals
- Weather-aware items (jacket only when it is cold or raining)
- "Before you go" nudge tied to calendar events
- Bluetooth tag pairing (AirTag / Tile style)
- A home-screen widget with today's checklist
