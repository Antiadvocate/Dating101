# Dating 101

A dating game where the person you are dating is a full social simulation, the
story has a spine you can see from turn one, and nothing on the page was written
before you got there.

It runs entirely in your browser, on your own OpenRouter key. There is no server.

---

## What it actually is

You describe up to four people you would like to date. A forge builds the town
they live in — ten places, their histories, how each of them talks, what they are
doing on a Tuesday afternoon — and then writes each of them an **arc**: eight
chapters and three endings, specific to that person.

Then you play it. Inside a chapter you talk and act with total freedom, in plain
text. When the chapter's job is done, three doors come up and you pick one, and
that is the only place the game takes the wheel back.

The simulation underneath is [Weft](https://github.com/Antiadvocate/weft), vendored
as a subtree and left alone. Weft already models attraction as a separate channel
from warmth, tracks what each person privately believes about you (including the
things they have wrong), moves everybody around on their own schedule when you are
not looking, and keeps a verified ledger of what has actually been said. This
project adds the structure, the gates, and the entire interface.

## The three ideas it is built on

**A beat is a job, not a scene.** The spine is written at casting, but nothing on
it says "she takes you to the pier and it rains." It says "the first time she has
to choose you over something she already promised somebody else." That is knowable
before turn one, it reads as authored when you look at the spine, and the actual
scene is generated out of live state at the moment you arrive — so the same
chapter at warmth 60 and at warmth 15 produces two evenings with nothing in common
but their purpose. Rails you can see; a road that is not drawn until you are on it.

**The chapter closes when it closes.** Not on a timer — the in-world clock is an
estimate read off the prose and it drifts. A chapter ends when a small judging call
says its job actually happened, bracketed by a turn floor so it cannot resolve
before it has been played and a turn ceiling so it cannot be ground out. There is a
fixed number of chapters. You cannot buy a better ending with another forty turns
of being charming; time is a budget, not a resource.

**There is no affection meter.** Weft is already simulating the relationship and a
second number maintained beside it would desynchronise within ten turns. So the
HUD is a sentence — an observation of her behaviour toward you, derived from the
live edge, costing nothing, and checkable against the page. If it says she keeps
her answers to about the length of the question and the prose has her talking
freely, one of them is wrong and you can see it. The raw numbers are still there,
behind a deliberate flip in the dossier, along with the one concrete thing she
believes about you that is not true.

## The design

It is a printed keepsake, not a visual novel and not a dashboard.

- **Paper, not screen.** Warm bone ground, ink type, a grain pass over everything.
  Night mode is a different printing rather than an inversion.
- **The person owns the colour.** Each love interest is assigned one hue at
  casting and it becomes the accent for the whole interface while you are on their
  route — the rules, the dialogue, the drop caps, the doors. Four routes, four
  palettes, one layout.
- **Every picture is a photograph.** Generated images vary wildly in style from
  one call to the next; a shared frame, grade and grain make the *set* look
  deliberate even when the individual frames do not match. Nothing renders model
  output except the `Photo` component.
- **The page is a reading column, not a text box.** Thirty-three ems, left
  aligned, 1.66 line height. Spoken lines pull out of the column and take a rule
  and a nameplate in the speaker's colour, so narration reads like a novel and
  dialogue reads like a play.
- **The spine is a contact sheet.** Every chapter you have played is a frame with
  its photograph; every one you have not is an unexposed frame with a title. The
  door you took out of each chapter is printed on the line between them, and all
  three endings sit at the bottom from the beginning. Knowing the two ways it can
  go wrong is most of what makes the middle tense.

## The tics

Generated romance fails in a specific, boring way: when a model has nothing to
write it reaches for the body. A breath catches, a pulse quickens, something
unreadable crosses a face, a flush climbs a neck. None of those sentences carry
information, and once one appears the next three arrive within the paragraph
because the model is now imitating itself.

`src/game/tics.ts` carries a prompt fragment that forbids the whole family in
every generation call, and a detector that reads what actually came back and
quotes the offending phrase into the next turn's direction. A rule in a cached
prefix is read as reference; a sentence you just wrote is read as a mistake, and
only the second one changes behaviour. Dialogue is exempt from every pattern — a
person is allowed to say "I've never felt like this", the narration is not allowed
to say it for them.

## Running it

```bash
npm install
npm run dev      # localhost:5173
npm run build    # dist/ — the static bundle Pages serves
```

Paste an OpenRouter key when it asks. It is stored in that browser and sent to
openrouter.ai and nowhere else. Saves live in IndexedDB on the device.

Push to `main` and the included workflow builds and publishes to GitHub Pages.

## Keeping Weft up to date

Weft lives at `vendor/weft` as a git subtree, aliased to `@weft/*`. To pull
upstream changes:

```bash
git fetch weft main
git subtree pull --prefix vendor/weft weft main --squash
```

Nothing in `vendor/` is edited. The engine only ever imports `../llm`, which is
what makes it portable in the first place; everything this project adds lives in
`src/game` and `src/views`.

## Layout

```
src/game/     the dating layer
  types.ts      the spine, beats, doors, terminals, the save extension
  arc.ts        pure: heat, gating, grading, which ending you earned
  read.ts       state → a sentence about her behaviour. Zero tokens.
  casting.ts    the forge seed and the spine call
  gate.ts       chapter openings, the discharge judge, the doors, the ending
  tics.ts       the romance tic detector and the prohibition
  api.ts        the glue over Weft's api
src/ui/       Photo, Prose, the kit
src/views/    Shelf · Casting · Scene · Spine · Dossier · Keepsakes · Studio
vendor/weft/  the engine, untouched
```

## Looking at it

`tools/screens.mjs` boots the dev server's page in Chromium, seeds a fabricated
save into IndexedDB, and photographs every screen at desktop and phone width. It
is how the layout bugs in this thing were actually found — a centred column that
was pinned to the left on a wide screen, a nameplate that never appeared because
attribution only matched full names, and a spine that printed each chapter's exit
door one frame too early.

```bash
npm run dev &
node tools/screens.mjs      # writes ./screens/*.png
```
