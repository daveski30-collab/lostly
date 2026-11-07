# Testing Lostly

## 1. In the browser (2 minutes, no setup)

Open https://lostly-theta.vercel.app on any phone or computer.

1. Go through setup (pick your stuff, pick places, "Yes, save Home here").
2. Tap **Leaving now?** and run a check. Leave something unchecked, tap **Done**, then **Leaving without them**. It should show up under **Left behind** on the home screen.
3. Tap **+ Something for next time** on Home, add "Permission slip", then tap **Leaving now?**. It should be the first tile, highlighted.
4. Tap **🧪 Test lab** and **Run all 9 tests**. All nine should pass. Each one shows what it expected and what actually happened.
5. In Test lab, pick **🥶 Cold + rain** and **Open the checklist** to see the weather-aware list. Switch to **☀️ Warm + dry** and the jacket and umbrella disappear.

To start over: Test lab, **Reset Lostly**, tap twice.

## 2. On a real phone (real background nudges)

Background location and notifications need a "development build" (the Expo Go app cannot do background location).

**Android (free):**

```bash
npm install
npx eas-cli@latest login          # free Expo account
npx eas-cli@latest build --profile development --platform android
```

When the build finishes, open the link on the Android phone and install the app. Then run `npx expo start --dev-client` on your computer and open the app.

**iPhone:** the same command with `--platform ios` works, but installing on a device needs an Apple Developer account ($99/year).

**Real-world test:** save Home, set "Only if I stayed at least" to 5 min, stay 5+ minutes, then walk or drive about 200 m away. The nudge usually arrives within 1 to 3 minutes of leaving. Long-press it to see the **✅ Got everything** button.

On the phone, Test lab also has **Send real notifications**, which pops up the actual nudges while the tests run.

## 3. Code tests

```bash
npm test          # rules, weather, stats, and every Test lab scenario
npm run typecheck
npx expo lint
```
