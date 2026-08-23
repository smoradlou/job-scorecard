## Context

See `add-custom-values-interview/design.md` for the interview architecture.
This change improves the system prompt driving the chat interview, based on
research into occupational psychology and values-elicitation methodology.

The prior prompt covered job *conditions* (comp floor, remote, culture) as
the primary interview topics. Research and user observation confirmed this
produces condition-level output — "remote-first, good pay, thoughtful
team" — rather than stable underlying values. A condition changes offer to
offer; a value is what the condition serves.

## Values Framework

### Dimensions (8)

The interview maps toward these eight dimensions. Each entry documents its
source frameworks and the decision behind its inclusion.

| Dimension | Definition | Sources |
|---|---|---|
| **Security** | Financial floor, company health, role stability, predictability of situation | Schwartz (1992) Security value; Schein (2006) Security/Stability anchor; Super WVI |
| **Influence** | Real decision authority that shapes outcomes and direction — not just independence from oversight | McClelland (1960s) Power need (non-pejorative: drive to shape through others); Schein General Managerial anchor. Renamed from "Autonomy" — Autonomy reads colloquially as "wants to work alone," Influence better captures scope and outward impact |
| **Mastery** | Getting better at something that matters; not stagnating; craftsperson orientation | SDT Competence (Deci & Ryan); Schein Technical/Functional anchor; intrinsic motivation literature |
| **Impact** | Work produces something meaningful beyond the immediate task; matters to the world or to users | Schwartz Universalism/Benevolence; Steger et al. (2012) meaningful work; Schein Service/Dedication anchor |
| **Belonging** | Peer-quality team; psychological safety; being genuinely seen and respected as a colleague | SDT Relatedness; McClelland Affiliation need |
| **Recognition** | Expertise taken seriously; advancement appropriate to contribution; status | Schwartz Achievement/Power; McClelland Achievement need; Schein General Managerial anchor |
| **Stimulation** | Hard, novel, risky work; appetite for challenge over comfort; the antithesis of maintenance work. Sara's original *Courage* criterion. | Schwartz (1992) Stimulation value; Schein Pure Challenge anchor |
| **Inquiry** | Proximity to the intellectual frontier; intrinsic learning motivation; research-adjacent work; domain curiosity. Sara's original *Curiosity* criterion. | Schwartz Self-Direction; SDT Competence (intrinsic mastery); distinct from Stimulation — a role can be hard without requiring curiosity (e.g. managing 20 people) and intellectually rich without being risky |

### Constraints (tracked separately)

Compensation floor, remote/location preference, relocation timeline. These
are practical requirements, not value dimensions — binary gates rather than
axes of flourishing. Collected at the end of the interview, not used as
anchors that shape question sequence.

### Decisions

**Stimulation and Inquiry are separate dimensions.** A challenging role (VP
Eng, scaling a team under pressure) satisfies Stimulation without Inquiry.
A deep research role satisfies Inquiry without necessarily being hard/risky.
They're orthogonal, so collapsing them would mask real differences between
people.

**Influence replaces Autonomy.** "Autonomy" in the research literature means
self-determination (SDT, Schwartz Self-Direction) but reads colloquially as
"wants to work alone / not be blocked by others." The user's actual construct
was about influence over situations — predictability plus outward impact.
Influence (decision authority that ripples outward) is the more accurate
label and elicits better responses.

**Control is dissolved into Security + Influence.** The original *Control*
criterion (Sara's) had two components: predictability (→ Security) and scope
of influence (→ Influence). No single dimension is lost; both are covered
with greater precision.

**8 dimensions, not 6 or 10.** 6 was the original hardcoded set — too few
to capture the full range of motivational variation. 10+ dimensions would
make synthesis noisy and the interview too long for 3–5 exchanges. 8 gives
the AI enough targets to detect meaningful variation without requiring an
exhaustive interview.

## Elicitation Approach

Based on: Reynolds & Gutman (1988) laddering/means-end chains; Miller &
Rollnick (2012) Motivational Interviewing; Savickas (2011) Career
Construction Interview; Xu et al. (2022) chatbot career intervention review.

**Three structural changes from the prior prompt:**

1. **Lead with behavioral retrospective, not preference question.** "What
   are you looking for?" produces socially desirable answers ("work-life
   balance," "good culture"). "Tell me about a time you felt most fully
   yourself at work" produces behavioral narrative, which reveals values
   rather than self-report. This is the opener in Schein's Career Anchors
   interview and Savickas's Career Construction Interview.

2. **Reflective naming before each follow-up.** Before asking the next
   question, the AI names the value it heard embedded in the answer (e.g.
   "That sounds like Inquiry — wanting to stay at the frontier rather than
   execute on known patterns"). MI research on chatbots (Fadhil et al.,
   2021) shows reflective naming produces significantly higher self-disclosure
   and perceived understanding than question-only formats. It also serves as
   a correction opportunity — if the AI names the wrong value, the user
   will say so.

3. **Framework as mapping target, not checklist.** The AI's job is to
   determine which 2–3 of the 8 dimensions are primary for this person.
   Questions adapt to what's been revealed rather than running a fixed
   script. Constraints (comp, location) are collected last.
