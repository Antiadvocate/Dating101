import { chromium } from "playwright";

const BASE = "http://127.0.0.1:5199/";
const OUT = process.env.SHOT_OUT ?? "./screens";

const SAVE = () => {
  const now = new Date().toISOString();
  const beat = (i, title, when, where, status) => ({
    id: "b" + i, idx: i, title, job: "x", where, when,
    floor: 4, ceiling: 11, status,
  });
  return {
    id: "demo1", name: "Harbour, off season", created_at: now, updated_at: now,
    world_bible: {
      name: "Sesta Point", era: "now", technology_level: "modern", magic_rules: "none",
      forbidden: "", what_people_fear: "", cultures_and_languages: "", climate_and_geography: "",
      calendar_and_currency: "", political_situation: "A harbour town in the off season.",
      art_direction: "35mm film, available light, grain, muted",
      tone: "contemporary, adult, plainly written",
      difficulty_profile: { lethality: "low", friction_density: "balanced", antagonist_aggression: "slow_burn", protagonist_competence: "average" },
    },
    model_settings: {},
    world: {
      canon: [], current_turn: 7, current_time: "Day 4, 21:40",
      weather: "wind off the water", player_location: "loc1",
      money: "", present: ["char_a"],
      places: { loc1: { id: "loc1", name: "The Pilot Boat", description_facts: "", contains: [] } },
      threads: [], consequences: [], clocks: [], norms: [], rumors: [],
      edges: [{ from: "char_a", to: "char_player", warmth: 38, trust: 16, power: 0, attraction: 44, attraction_base: 30, desire_admissibility: 0.55, notes: "", updated_turn: 7 }],
    },
    characters: {
      char_player: { character_id: "char_player", name: "Ash Kovač", age: 34, pronouns: "he/him", appearance_facts: "", background: "Fixes espresso machines.", core_traits: [], values: [], speech_pattern: "", skills: {}, intelligence: "average", gregariousness: .6 },
      char_a: {
        character_id: "char_a", name: "Vesna Orlić", age: 40, pronouns: "she/her",
        appearance_facts: "Dark hair cut short, a burn scar across the back of one wrist.",
        appearance_now: "Kitchen whites still on, sleeves pushed up, apron off.",
        background: "Runs the kitchen at a place that is better than it needs to be. Divorced four years, funny in a way that lands about eighty percent of the time and she does not adjust for the twenty. Her brother lives with her and it is not working.",
        core_traits: ["blunt", "competent", "impatient with being managed"], values: ["straightness"],
        speech_pattern: "short, dry, does not soften", skills: {}, intelligence: "sharp",
        gregariousness: .45, location: "loc1", texture: ["knows every tide table by heart", "cannot stand a badly stacked dishwasher"],
      },
    },
    traits: { char_a: [{ id: "t1", label: "lets him see the tired version", origin: "The night the van did not start and she stopped performing.", behavioral_impact: "", intensity: 4, self_weight: 2, last_reinforced_turn: 6, reinforcement_count: 2 }] },
    habits: {}, condition: { char_a: { injuries: [], conditions: ["worn out"], fatigue: "tired", hunger: "fed", inventory: [], wearing: [], psyche: {} } },
    memory: {
      char_player: { character_id: "char_player", core: [], episodic: [], beliefs: [], knows: [], facts: [] },
      char_a: { character_id: "char_a", core: [], episodic: [], beliefs: [], knows: [],
        facts: [{ content: "Her brother has been staying since March and has not looked for work.", turn: 5, quote: "He's been on my sofa since March." }] },
    },
    minds: { char_a: { character_id: "char_a", about: [{ target: "char_player", predicted_warmth: 20, predicted_stance: "unknown", held_false: "That you are only here until something better comes up, because that is what the last one did.", surprise: .3, confidence: .5, updated_turn: 7 }] } },
    history: [
      { turn: 0, kind: "opening", player_action: "", narrator_prose: "The Pilot Boat has four people in it and two of them are staff. Vesna is at the far end of the bar with a clipboard and the look of somebody doing arithmetic she has already done twice. The wind is coming off the water hard enough that the door moves in its frame.", summary: "", offscreen: [], time_label: "Day 4, 21:10" },
      { turn: 7, kind: "turn", player_action: "Ask her what she's counting.", action_mode: "say",
        narrator_prose: "She does not look up. The pen goes down the column again.\n\n\"Anchovies,\" she says. \"Somebody has taken four tins of anchovies and I would like to know who, because it is not a thing you steal by accident.\"\n\nShe turns the clipboard round so you can see it, which is more of an answer than the question deserved. The column is neat. The subtraction is neat. Four tins.\n\n\"You could have miscounted on Tuesday.\"\n\n\"I could have.\" She takes the clipboard back. \"I didn't.\"",
        summary: "", offscreen: [], time_label: "Day 4, 21:40" },
    ],
    telemetry: [], pressure_trace: [], records: [], snapshots: [], chapters: [],
    dating: {
      version: 1, active: "char_a", gate: null, needs_opening: false, keepsakes: [],
      register: "contemporary, adult, plainly written",
      heat: {
        explicitness: "explicit",
        palette: ["restraint", "still in work clothes", "risk of being caught", "being told what to do"],
        limits: ["anything involving her brother"],
      },
      appetites: {
        char_a: {
          into: ["being told what to do by somebody who has earned it", "her hands out of the way", "being caught at it in her own kitchen"],
          curious: ["marks that last past a shift"],
          unsaid: "She wants to be asked to stop running it for one evening, and she will never ask, because asking would mean admitting she is tired.",
          limits: ["anything she cannot walk out of", "being laughed at", "anybody from work knowing"],
          register: "Talks the whole way through and gets sharper the closer it gets, which is not a mood, it is a defence. Cannot ask for a single thing directly.",
          discovered: ["her hands out of the way", "being laughed at"],
          unsaid_found: false,
        },
      },
      routes: {
        char_a: {
          char_id: "char_a", name: "Vesna Orlić", accent: "verd",
          brief: "Runs a kitchen. Forty, divorced.",
          cursor: 3, state: "running", rung: 2,
          beats: [
            { ...beat(0, "The night the anchovies go missing", "a Tuesday, late", "The Pilot Boat", "done"), outcome: "warm", taken: "Stay until she closes up and walk out with her", heat_in: 30, heat_out: 39 },
            { ...beat(1, "What she is like around her brother", "the following Sunday", "Vesna's flat", "done"), outcome: "cool", taken: "Say nothing about the brother and let it sit", heat_in: 39, heat_out: 35 },
            { ...beat(2, "The delivery that does not arrive", "Thursday, before service", "The cold store", "done"), outcome: "warm", taken: "Drive to Rijeka and get it yourself", heat_in: 35, heat_out: 44 },
            { ...beat(3, "The first hour neither of you is working", "Sunday, and it is raining", "The Pilot Boat", "open"), entered_turn: 4, heat_in: 44,
              opening: "The place is shut and she has left the back door on the latch, which is either trust or forgetfulness and you decide not to ask which. She is sitting on the prep counter with her boots off, eating something out of a container with a fork that is far too big for it. The rain is doing what it has been doing since Friday." },
            beat(4, "Somebody tells her about you", "a week later", "Ika's kitchen", "locked"),
            beat(5, "The thing she has not said about the divorce", "some days after that", "The seawall", "locked"),
            beat(6, "A night that runs past the last ferry", "and then, all at once", "Vesna's flat", "locked"),
            beat(7, "What this is going to be", "the morning", "Vesna's flat", "locked"),
          ],
          terminals: [
            { kind: "win", title: "Two coffees, and one of them is yours", description: "An ordinary Tuesday where nobody has to decide anything, and she puts the second cup down in front of you without asking how you take it." },
            { kind: "loss", title: "She stops leaving the back door on the latch", description: "Nothing is said. The shifts go back to being shifts, and you find out from Ika that she has been seeing somebody from Rijeka since April." },
            { kind: "sour", title: "You get the flat and the brother and none of the truth", description: "You are in her life and she has stopped telling you things, and neither of you will name the month it changed." },
          ],
        },
      },
    },
  };
};

const seed = async (page) => {
  await page.evaluate((save) => new Promise((res, rej) => {
    const req = indexedDB.open("weft", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("saves", { keyPath: "id" });
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("saves", "readwrite");
      tx.objectStore("saves").put(save);
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error);
    };
    req.onerror = () => rej(req.error);
  }), SAVE());
};

const shot = async (page, name, full = false) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log("→", name);
};

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const [tag, w, h] of [["wide", 1280, 860], ["phone", 402, 800]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
  await page.goto(BASE);
  await page.evaluate(() => localStorage.setItem("weft-openrouter-key", "sk-or-v1-demo"));
  await seed(page);
  await page.goto(BASE);
  await shot(page, `${tag}-1-shelf`, true);

  await page.getByText("Vesna Orlić").first().click();
  await shot(page, `${tag}-2-scene`);

  // the gate
  await page.evaluate(() => new Promise((res) => {
    const req = indexedDB.open("weft", 1);
    req.onsuccess = () => {
      const st = req.result.transaction("saves", "readwrite").objectStore("saves");
      const g = st.get("demo1");
      g.onsuccess = () => {
        const s = g.result;
        s.dating.gate = { beat_idx: 3, opened_turn: 7, because: "discharged", doors: [
          { id: "d1", label: "Ask what she is actually eating and take the fork", read: "You make it a thing you are doing together, in her kitchen, with the door shut.", to: 4, bearing: "toward" },
          { id: "d2", label: "Tell her the brother has to go", read: "She did not ask you, and she will remember that you said it first.", to: 4, bearing: "away" },
          { id: "d3", label: "Sit down on the floor and let the rain do the talking", read: "Nothing is spent and nothing is settled, and the hour goes anyway.", to: 4, bearing: "across" },
        ] };
        st.put(s);
        setTimeout(res, 200);
      };
    };
  }));
  await page.reload();
  await page.waitForTimeout(700);
  await page.getByText("Vesna Orlić").first().click().catch(() => {});
  await shot(page, `${tag}-3-gate`);

  await page.locator('button[title="the spine"]').click();
  await shot(page, `${tag}-4-spine`, true);
  await page.locator('button[title="her"]').click();
  await shot(page, `${tag}-5-dossier`, true);
  await page.locator('button[title="studio"]').click();
  await shot(page, `${tag}-6-studio`, true);
  // The model picker, opened from the studio. Worth photographing on the
  // failure path too: this sandbox cannot reach openrouter.ai, so what these
  // shots actually prove is that the fallback list is usable.
  await page.locator('[data-model-picker="narrator"]').click();
  await shot(page, `${tag}-13-models`);
  await page.locator('button[aria-label="close"]').click();
  await page.waitForTimeout(300);
  await page.locator('button[title="console"]').click();
  await shot(page, `${tag}-9-console`, true);
  await page.getByText("Open the editor").click();
  await shot(page, `${tag}-10-editor`, true);
  await page.getByText("Desire", { exact: true }).click();
  await shot(page, `${tag}-11-editor-desire`, true);
  await ctx.close();
}

// casting flow, wide only, fresh profile
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto(BASE);
await page.evaluate(() => localStorage.setItem("weft-openrouter-key", "sk-or-v1-demo"));
await page.goto(BASE);
await shot(page, "wide-0-gate-none");
await page.getByText("Start casting").click();
await shot(page, "wide-7-casting-you", true);

// Step through casting. The waits matter: AnimatePresence keeps the outgoing
// step mounted for a third of a second, so a bare fill() lands on the step you
// just left and the Next button never enables.
const next = async () => {
  const b = page.locator('button:has-text("Next")');
  await b.waitFor({ state: "visible" });
  await page.waitForTimeout(450);
  await b.click();
  await page.waitForTimeout(600);
};
await page.locator("input.field").first().fill("Ash Kovač");
await page.locator("textarea.field").first().fill("Thirty-four. Moved back in March. I fix espresso machines, which is a real trade and pays like a hobby.");
await next();
await shot(page, "wide-8-casting-them", true);
await page.locator("textarea.field").first().fill("Runs the kitchen at a place better than it needs to be. Forty, divorced, funny about eighty percent of the time and she does not adjust for the rest.");
await next();
await page.locator("textarea.field").first().fill("explicit, unhurried, more interested in people than in acts");
await next();
await shot(page, "wide-12-casting-heat", true);
await ctx.close();
await b.close();
