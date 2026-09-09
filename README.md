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

## Appetites

It is an adult game, so desire is a system rather than a setting.

A checklist at casting would produce a vending machine: every character wants
everything on it, nobody refuses anything, and by chapter four the four routes
differ only by name. So appetites are per-person and have four parts, and the two
that matter are the ones a checklist does not have.

- **into** — what they want and would say so.
- **curious** — what they have not done and would try, with someone they trusted.
- **unsaid** — one thing they want and will not ask for. This is the game. It is
  not in the dossier when you meet them; the narrator is never told what it is;
  it surfaces only if play produces the conditions in which somebody would risk
  saying a thing like that. Finding it is worth more than anything on the `into`
  list, because anyone can read that list.
- **limits** — what they will not do, ever.

**Limits are not a safety feature, they are the drama.** A person who will do
anything is not a person and is not interesting to pursue — there is nothing to
find out and nothing to be trusted with. The forge is told to write at least one
limit that sits directly beside something on the same person's `into` list, so it
is a line rather than a fence around empty ground. A limit is hard: they refuse,
plainly, and Weft records refusal as a first-class stance, so it has consequences
the simulation actually carries.

The dossier shows only what you have **discovered**. The truth is on the card from
turn one and the game hands it over a line at a time, matched loosely off what
each scene revealed. The console has a "read the answers" button for anyone who
would rather just look; it is one-way and says so.

**The ladder.** Generated erotica teleports — give a model two people with high
recorded attraction and it will write them in bed in chapter two, because nothing
told it what has and has not already happened and the attraction number reads as
permission. So how far things have physically gone is tracked as a rung from 0 to
6, read off the page by the gate judge (which was already being called, so it
costs nothing) and allowed to move at most one rung per chapter. It is the only
thing standing between "she is interested" and a scene that skips four steps.

**Explicitness** is a save-level dial — charged, frank, or explicit — changeable
mid-game from the studio. Weft's own narrator prompt already says to scale heat
to the story's level and its recap pass is told never to sanitize, so this is a
lever the engine was built to read.

**Two floors.** Your own never-list is pasted into every generation call this
layer makes, not stated once at world creation — a constraint set at turn zero is
one the model stopped seeing around turn forty. And separately: every character
is an adult, asserted on every call, validated in casting and in the editor, with
no setting for it and no way to edit it out from inside the game.

## Editing and the console

Everything about a person is editable — name, age, looks, history, traits, voice,
taste, appetites, limits, and the three numbers the whole game is played for. This
is not a debug affordance. The forge writes a first draft out of a paragraph you
typed and it will get things wrong; whether you can reach in and fix the voice on
turn three, instead of rerolling the whole town, is the difference between a game
you play once and one you keep.

Two fields carry warnings because they are load-bearing in non-obvious ways. **Age**
is stored a dozen times — as a number, and as prose in backgrounds, memories, edge
notes and canon — and a sentence beats a field every time, so edits run through
Weft's reconciliation pass, which reports what it changed and what it left alone.
**Voice** is rewritten by three separate automatic passes that are useful on a
character the engine wrote and vandalism on one you wrote; there is a lock.

The console (the sliders mark) is cheats in the ordinary sense: force or reroll a
gate, rewrite a chapter opening, jump to any chapter, set the ladder, set warmth
and wanting and trust directly, reveal a card, force any of the three endings,
reopen a finished route, god mode, set the clock, roll back, and raw JSON for the
world. Nothing is withheld — the state is already yours, sitting in IndexedDB,
and making you open devtools instead of pressing a button does not protect
anything. Every control says what it costs before you press it; several are
one-way and say so.

## The tics

Generated romance fails in a specific, boring way: when a model has nothing to
write it reaches for the body. A breath catches, a pulse quickens, something
unreadable crosses a face, a flush climbs a neck. None of those sentences carry
information, and once one appears the next three arrive within the paragraph
because the model is now imitating itself.

There is a second half for sex specifically, and the failure there is not that
it is too explicit — it is that the prose goes **abstract** at exactly the moment
it should get specific. Everything is fine until clothes come off and then every
noun becomes a euphemism, every verb becomes weather, and two particular people
become anybody. Caught families: euphemism for the body, weather instead of
sensation, the dissolution (coming undone, shattering, seeing stars), the body as
a separate agent, and force used as intensity.

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

### Publishing

Pushes to `main` build and publish to GitHub Pages automatically. To publish a
branch that is not main — a work-in-progress, before merging — go to **Actions →
Deploy to Pages → Run workflow** and pick the branch; the workflow file has to
exist on that branch, which it does.

Pages needs **Settings → Pages → Build and deployment → Source → GitHub Actions**
set once. `base: "./"` in the Vite config means the bundle works from a user root
or a project subpath with no per-repo configuration.

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
  appetite.ts   what people want, what they will not do, the ladder, the floor
  tics.ts       the romance and erotica tic detectors, and the prohibitions
  api.ts        the glue over Weft's api
src/ui/       Photo, Prose, the kit
src/views/    Shelf · Casting · Scene · Spine · Dossier · Keepsakes · Studio
              Editor (every field on a person) · Debug (the console)
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
