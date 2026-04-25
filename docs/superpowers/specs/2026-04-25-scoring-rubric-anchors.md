# Scoring Rubric — Anchor Exemplars (v1, fill-in template)

The Claude scoring agent grades each person across five dimensions on a 0–10 scale. To keep the scale calibrated across people (and across runs), every grading prompt includes few-shot **anchor exemplars** — concrete examples of what a "2", a "5", and an "8" look like for each dimension.

This file is the template Ethan fills in with examples drawn from his own real relationships. The scoring service reads these anchors and injects them into the Claude prompt at runtime.

---

## How to fill this in

For each dimension, write **3 short anchor examples**: one at level 2 (low), one at level 5 (mid), one at level 8 (high). Each anchor is just a few sentences describing what someone at that level looks like — it does not need to be a full Person JSON, just enough signal that Claude can pattern-match against it.

Use real people from your life (anonymize the names if you want). The whole point is that *your* judgment of a "5" anchors *Claude's* judgment of a 5. The closer your examples sit to the line between levels, the better the calibration.

Tip: write the level-8 first, then level-2, then level-5 last. The middle is the hardest to nail and gets easier once the endpoints are anchored.

---

## Dimension 1 — Depth of Knowledge

**Definition:** How much specific, factual context the user knows about the person across multiple life domains (school, work, family, hobbies, health, history, etc.). Not emotional closeness — just *informational* depth.

- **Anchor: 2 (shallow)**
  > **Who:** "Maya" — a UCLA junior I had a 1-on-1 with through UPE (the CS honor society) the day before.
  > **What I know:** Her first name, that she's a junior, that she's from the Bay Area, that she's interning at Google this summer, that she's a leader in clubs I'm interested in joining. We had a two-hour conversation, mostly resume-shaped.
  > **What I don't know:** Her hobbies, her family, her closest friends, her anxieties, what she's like outside the professional setting, anything resembling a life story. Literally met her yesterday — there hasn't been time to build personal texture.
  > **Why this is a 2, not a 1 or 3:** A 1 would be name-recognition only ("there's a junior named Maya in UPE"). A 3 would mean at least one *personal* detail had stuck — a hobby, a family fact, a value. At 2, I have a name plus a stack of categorical/professional facts and zero personal texture.

  > **Implied structured signals:**
  > - tenure: just_met
  > - frequency: rarely
  > - last_interaction: this_week
  > - they_show_up_for_me: not_sure
  > - i_show_up_for_them: not_sure
  > - knows_about_me: not_really

- **Anchor: 5 (moderate)**
  > **Who:** "Ryan" — a good friend I met at college this year.
  > **What I know:** He has a brother, is Chinese, plays badminton, is smart, and his birthday is in the summer (don't know the exact date). Scattered facts across several domains, none of them deep.
  > **What I don't know:** His hometown specifics, his major, his deeper hobbies, his family beyond the brother, his career goals, his romantic life, his anxieties, his closest non-mutual friends, his childhood. Each domain has at most one fact.
  > **Why this is a 5, not a 4 or 6:** A 4 would be one domain shallow and the rest blank ("he plays badminton, that's about it"). A 6 would mean at least one domain is filled in *deeply* — e.g., I'd know his major, his coursework, his career thoughts. At 5, I have *breadth without depth* — facts across ~4 domains but each one-line shallow.

  > **Implied structured signals:**
  > - tenure: months
  > - frequency: weekly
  > - last_interaction: this_week
  > - they_show_up_for_me: sometimes
  > - i_show_up_for_them: sometimes
  > - knows_about_me: some_of_it

- **Anchor: 8 (deep)**
  > **Who:** "Theo" — close friend I've known since elementary school.
  > **What I know:** He's at the Naval Academy, gets up to a lot of questionable stuff there but is lovable. Korean, somewhat whitewashed. Athletic, very jacked, used to run track. Wears glasses. Huge Taylor Swift fan. Has had a long-running crush on a girl in our friend group whom we all dislike. Parents divorced; he has a stepmom and a stepdad. Family in NY. Splits breaks between his Dad in LA and family in SD. Years of shared context behind all of it.
  > **What I don't know:** The fine-grained academic and career specifics inside the Naval Academy, the dynamics of his current friend group there, his day-to-day routines.
  > **Why this is an 8, not a 7 or 9:** A 7 would be ~3 domains filled deeply with 2 still mostly blank. A 9 would be daily-life granularity — what he ate this week, what he texted about today, current emotional weather. At 8, ~5 domains are filled with specifics (family structure, athletic history, romantic patterns, cultural identity, location patterns) and only 1–2 meaningful gaps remain.

  > **Implied structured signals:**
  > - tenure: lifetime
  > - frequency: weekly
  > - last_interaction: this_week
  > - they_show_up_for_me: yes
  > - i_show_up_for_them: yes
  > - knows_about_me: most_of_it

---

## Dimension 2 — Emotional Intimacy

**Definition:** How emotionally close and vulnerable the relationship is. Signals: have you shared difficult moments, do they know your real feelings, have you been there for each other in low points. Not just "we get along" — actual emotional weight.

- **Anchor: 2 (low intimacy)**
  > **Who:** "Lena" — a friend from a nonprofit club at school; she's the current head.
  > **What we share:** Club logistics, school updates, surface-level life stuff. She's warm and the conversations are pleasant, but they stay within the club/school perimeter.
  > **Where the emotional weight stops:** Nothing personal has been exchanged in either direction — no frustrations, no anxieties, no moments of real vulnerability. If something hard happened to either of us, neither of us would bring it up to the other.
  > **Why this is a 2, not a 1 or 3:** A 1 would be purely transactional ("can you cover this club shift?") with no friendliness. A 3 would mean at least one personal acknowledgement had landed — a hard week, a stressful midterm, a flicker of vulnerability. At 2, the relationship is friendly but emotionally sealed: warmth without weight.

  > **Implied structured signals:**
  > - tenure: months
  > - frequency: weekly
  > - they_show_up_for_me: not_really
  > - i_show_up_for_them: not_really
  > - knows_about_me: not_really

- **Anchor: 5 (moderate intimacy)**
  > **Who:** "Marco" — a friend in my CS class.
  > **What we share:** Class frustrations and school stress. I've vented to him about doing badly in our shared class while he's doing well, and he's been consistently uplifting — never condescending. The vulnerability runs mostly one direction (me to him), but it lands genuinely and feels safe.
  > **Where the emotional weight stops:** We don't go into relationships, family, deeper anxieties, or non-academic struggles. The intimacy is real but bounded to a single trusted channel.
  > **Why this is a 5, not a 4 or 6:** A 4 would be surface-level class complaints ("ugh that homework") with no real emotional content. A 6 would mean the channel had broadened — we'd be venting across multiple life domains and the exchange would be bilateral. At 5, the intimacy is *real but narrow*: one trusted topic, mostly one-directional, working well within that frame.

  > **Implied structured signals:**
  > - tenure: months
  > - frequency: weekly
  > - they_show_up_for_me: yes
  > - i_show_up_for_them: sometimes
  > - knows_about_me: some_of_it

- **Anchor: 8 (high intimacy)**
  > **Who:** "Arjun" — a close friend I trust with the messy stuff.
  > **What we share:** Relationship issues — crushes, breakups, and the acute emotional meltdowns ("crash-outs") that come with them. Both of us vent and both of us listen. We've each gotten the other through periods of real turbulence and we know how to handle each other when things get hard.
  > **Where the emotional weight stops:** A small handful of topics I haven't yet brought to him (and presumably vice versa), but no major life domain is off-limits. The trust assumption is two-way and earned.
  > **Why this is an 8, not a 7 or 9:** A 7 would be high intimacy with a noticeable imbalance — one person being the "primary venter" while the other mostly listens. A 9 would mean essentially nothing is off-limits and we'd each be the *first* call in a crisis. At 8, the bridge is genuinely two-way and well-trafficked, with maybe one or two topics still pending exchange.

  > **Implied structured signals:**
  > - tenure: few_years
  > - frequency: weekly
  > - they_show_up_for_me: yes
  > - i_show_up_for_them: yes
  > - knows_about_me: most_of_it

---

## Dimension 3 — Recency / Frequency

**Definition:** How recently and how often you actually interact. Active weekly contact > monthly > yearly > "haven't talked in a while." Reads from `last_interaction_at`, recurring `important_events`, and frequency hints in `memories_together`.

_Note: this dimension is decoupled from friendship quality. A great friend you rarely see still scores low here; an acquaintance you eat lunch with every day still scores high. Read the data for **cadence**, not for emotional weight._

- **Anchor: 2 (rare/lapsed)**
  > **Who:** "Devin" — a friend who goes to NYU and visits LA periodically because his girlfriend lives here.
  > **Cadence:** A handful of times a year, driven entirely by his visits. He reliably reaches out to grab food when he's in town and has offered me a place to stay if I'm ever in NYU. Outside of those visits, the channel is essentially silent.
  > **Last contact:** Typically months between touchpoints. No active digital thread keeping it warm in between.
  > **Why this is a 2, not a 1 or 3:** A 1 would be fully lapsed — no contact in over a year, no upcoming visit on the horizon. A 3 would mean a thin always-on channel between visits — occasional texts, an annual ritual. At 2, contact is real and warm but visit-gated; without his trips here it would go quiet.

  > **Implied structured signals:**
  > - tenure: few_years
  > - frequency: rarely
  > - last_interaction: this_year
  > - channels: [in_person]

- **Anchor: 5 (occasional)**
  > **Who:** "Caleb" — a friend from home; he's at Purdue while I'm at UCLA.
  > **Cadence:** Occasional FaceTimes, usually as part of a group call with our home-friends. The contact piggybacks on the group's rhythm rather than having an independent one-on-one channel.
  > **Last contact:** Within the last few weeks via the group thread; no regular direct rhythm outside of that.
  > **Notably:** the friendship itself feels just as comfortable as the level-8 anchor below — the only thing missing is frequency. That's the dimension working as intended.
  > **Why this is a 5, not a 4 or 6:** A 4 would be only a few group check-ins a year. A 6 would mean a reliable one-on-one channel — biweekly direct calls or texts on top of the group. At 5, contact is consistent through a shared group thread but has no independent cadence of its own.

  > **Implied structured signals:**
  > - tenure: few_years
  > - frequency: monthly
  > - last_interaction: this_month
  > - channels: [call, text]

- **Anchor: 8 (frequent)**
  > **Who:** "Hugo" — a friend I see at school nearly every day.
  > **Cadence:** Daily — we share classes and eat lunch or dinner together on most days. Touchpoints are routine and embedded in the school week.
  > **Last contact:** Today, almost certainly.
  > **Why this is an 8, not a 7 or 9:** A 7 would be a few times a week — frequent but not embedded in daily routine. A 9 would mean continuous ambient contact across multiple channels — daily in-person *plus* an always-on text thread. At 8, frequency is high and habitual but flows through a single mode (in-person via shared schedule), without a second channel layered on top.

  > **Implied structured signals:**
  > - tenure: few_years
  > - frequency: daily
  > - last_interaction: today
  > - channels: [in_person]

---

## Dimension 4 — Shared History Density

**Definition:** How much accumulated shared experience the relationship has. Number and richness of distinct memories, length of time you've known each other, variety of contexts (different settings, different life phases). One vivid memory ≠ dense history; many specific memories across time and context = dense history.

_Note: density ≠ duration. Long acquaintance with little shared experience scores low. A short but rich friendship (many distinct contexts, varied settings) scores higher than a long, thin one._

- **Anchor: 2 (thin history)**
  > **Who:** "Sophie" — a friend from high school I've known since freshman year.
  > **Shared experiences:** We had a class together every year (freshman through senior) and chatted some throughout, but the contact stayed inside those classrooms. Almost nothing accumulated outside of school.
  > **What's missing in density:** No out-of-class hangouts, no shared trips, no shared projects, no group memories I could point to. She's going to college on the East Coast while I'm on the West, so there's no future overlap to thicken what's there.
  > **Why this is a 2, not a 1 or 3:** A 1 would be a single-semester classmate — too brief to count as shared history at all. A 3 would mean a handful of real out-of-class memories — a project trip, a group hangout. At 2, the *duration* is long but the *density* is thin: a lot of shared time, very little shared experience.

  > **Implied structured signals:**
  > - tenure: few_years
  > - frequency: rarely
  > - last_interaction: this_week

- **Anchor: 5 (moderate history)**
  > **Who:** "Brandon" — a friend I've known since freshman year of high school.
  > **Shared experiences:** Played on the same badminton team through HS. Still see each other and get food whenever I'm home. We text occasionally and trade basketball reels. Multiple touchpoints — school, sports, ongoing post-HS check-ins — but all anchored to a single life phase.
  > **What's missing in density:** No shared history before HS, no current shared environment (he's at SDSU, I'm at UCLA), and the shared activities cluster around one bucket (sports + casual food). The history is real and actively maintained, but it doesn't span multiple life phases yet.
  > **Why this is a 5, not a 4 or 6:** A 4 would mean we'd lost continuity post-HS — the team-era memories without active follow-up. A 6 would mean overlap across two distinct life phases (e.g., shared elementary years on top, or a current shared project). At 5, the history is solidly built within one phase and actively maintained, but hasn't accumulated across phases.

  > **Implied structured signals:**
  > - tenure: few_years
  > - frequency: weekly
  > - last_interaction: this_week

- **Anchor: 8 (dense history)**
  > **Who:** "Eli" — a friend I've known since 5th grade.
  > **Shared experiences:** Grew up playing basketball together in the same rec league for years, then played badminton together through high school. We still see each other every time I go home. Multiple distinct contexts (childhood rec sports, school sports, home visits) layered across multiple life phases (elementary, middle, high school, ongoing).
  > **What's missing in density:** We're not at the same college, so the current life phase is paused on day-to-day shared experiences and runs on visit-based touchpoints instead.
  > **Why this is an 8, not a 7 or 9:** A 7 would be similar duration but fewer distinct contexts (e.g., only one shared activity throughout, not two across different settings). A 9 would mean continuous high density across *every* life phase including the present — same childhood + same college + ongoing daily overlap. At 8, density is deep across childhood and HS, with a current-phase pause but reliably refreshed touchpoints.

  > **Implied structured signals:**
  > - tenure: lifetime
  > - frequency: weekly
  > - last_interaction: this_week

---

## Dimension 5 — Reciprocity

**Definition:** How mutual the investment is. Does the other person reach out, remember things about you, plan things with you? Or is the energy mostly one-way? Bilateral effort = high; "I'm always the one initiating" = low.

_Note: reciprocity measures **initiative balance** — who reaches out, who plans, who remembers. A great relationship can still score mid here if one person carries the logistics. Read the data for who's *doing the work*, not for how good the relationship feels._

- **Anchor: 2 (one-sided)**
  > **Who:** "Prof. Becker" — a professor I really liked in winter quarter; I sat in on lunch with him twice.
  > **Initiative pattern:** Both lunches happened inside a structure he set up. I didn't follow up in office hours afterward and he didn't reach back out either. The bilateral signal is two visit-shaped touchpoints and nothing else.
  > **Where it falls short:** No out-of-band exchange — no follow-up emails, no check-ins, no mutual planning. The investment is essentially one-sided on his initial invite plus my passive acceptance.
  > **Why this is a 2, not a 1 or 3:** A 1 would be a fully cold contact — an email I sent that he never answered, with no two-way signal at all. A 3 would mean either of us had reached out *outside* the structured lunch context — a real follow-up message. At 2, there's a small two-way signal (he invited, I showed up) but the floor is low.

  > **Implied structured signals:**
  > - tenure: months
  > - they_show_up_for_me: not_really
  > - i_show_up_for_them: not_really
  > - knows_about_me: not_really

- **Anchor: 5 (somewhat mutual)**
  > **Who:** "Lukas" — a friend in my badminton circle.
  > **Initiative pattern:** We talk occasionally and plan stuff when I'm home. Sometimes one of us reaches out more than the other but it evens out over time. The shared sport gives us a natural orbit to coordinate around.
  > **Where it falls short:** Outside of "let's plan the next time you're home," we're not actively investing in each other's lives — no remembering of life events, no out-of-context check-ins. Reciprocity is real but transactional and event-driven.
  > **Why this is a 5, not a 4 or 6:** A 4 would mean I'm consistently the one initiating with thin response. A 6 would mean active cross-context investment — reaching out without a planned hangout in mind, following up on each other's life stuff. At 5, the bilateral effort is genuine and balanced but bounded to logistics.

  > **Implied structured signals:**
  > - tenure: few_years
  > - they_show_up_for_me: yes
  > - i_show_up_for_them: sometimes
  > - knows_about_me: some_of_it

- **Anchor: 8 (deeply mutual)**
  > **Who:** "Owen" — my older brother.
  > **Initiative pattern:** I'm usually the one reaching out — asking him about career and school stuff. But he reaches out too: he texted me this morning asking about a hackathon I'm doing. The directional balance leans toward me, but there's a real mutual signal that closes most of the gap.
  > **Where it falls short:** Strict turn-by-turn reciprocity isn't perfectly even — I initiate more often than he does. The mutual investment exists structurally (we're family) more than it's measured ping-by-ping.
  > **Why this is an 8, not a 7 or 9:** A 7 would show a similar pattern but with weaker mutual backstop — the imbalance would feel noticeable. A 9 would mean truly even initiation cadence — he reaches out as often as I do, across topics. At 8, the imbalance is real but low-stakes; the underlying mutual investment is strong enough that the initiation gap doesn't dent the score.

  > **Implied structured signals:**
  > - tenure: lifetime
  > - they_show_up_for_me: yes
  > - i_show_up_for_them: yes
  > - knows_about_me: most_of_it

---

## Validation set (after filling anchors)

Once anchors are in, hand-write **5 full Person JSONs** spanning the strength spectrum to validate the pipeline:

1. A "met once" acquaintance — expected aggregate ~2
2. A casual coworker / classmate — expected aggregate ~4
3. A solid friend — expected aggregate ~6
4. A close friend or sibling — expected aggregate ~8
5. A best friend / partner / parent — expected aggregate ~9–10

Run the scoring service against all 5. Check: do the aggregates roughly match expectations? Is the variance across the 3 samples low (≤ 10 points)? If a score feels off, the fix is usually a sharper anchor on the dimension that's drifting — not retraining or fancier prompting.
