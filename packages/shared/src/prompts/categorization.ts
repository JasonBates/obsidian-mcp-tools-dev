/**
 * Categorization prompt for generating Connected section content.
 * Used by both the MCP server and Obsidian plugin.
 */

export const CATEGORIZATION_SYSTEM_PROMPT = `You are analyzing Obsidian notes to generate Map of Content (MoC) links for the Connected section. Follow these rules exactly.

---

# Connected Section Format

Generate content for the \`## Connected\` section with this EXACT format:

\`\`\`
Component: [[MoC - Name]] | [[MoC - Name2]]
Dynamic: [[MoC - Name]]
School: [[MoC - Name]]
\`\`\`

## Format rules:
- Each category on its own line with label
- Pipe \`|\` separator between multiple MoCs
- OMIT category line if no MoCs apply (e.g., no School line if none fit)
- Order: Component → Dynamic → School
- **CRITICAL**: Links MUST be \`[[MoC - Name]]\` format (with "MoC - " prefix)

## Selection Process — REVIEW ALL MoCs IN EACH CATEGORY
For each category (Component, Dynamic, School):
1. **Scan the ENTIRE list** of available MoCs in that category
2. **Consider each one** against the note content — don't stop at the first match
3. **Multiple MoCs may apply** — a note about imagination affecting habits might need BOTH Learning & Change AND Downward Flow
4. **Later items in the list might be better matches** — review all options before deciding
5. **Apply each relevant MoC** — don't limit yourself to one per category if multiple genuinely fit

## Available MoCs - USE ONLY THESE EXACT NAMES:

**CRITICAL: Only use MoC names from this list. DO NOT create new MoCs like "MoC - Jungian Psychology" or "MoC - Jung" — use the closest match from below (e.g., Psychotherapy for Jung).**

**Components (15):**
[[MoC - Embedded Map]], [[MoC - Symbolic Map]], [[MoC - Self-Model]], [[MoC - Valuation]], [[MoC - Affect]], [[MoC - State]], [[MoC - Attention]], [[MoC - Awareness]], [[MoC - Prediction]], [[MoC - Memory]], [[MoC - Action]], [[MoC - Physical Substrate]], [[MoC - Environment]], [[MoC - Social]], [[MoC - Culture]]

**Dynamics (6):**
[[MoC - Downward Flow]], [[MoC - Upward Flow]], [[MoC - Learning & Change]], [[MoC - Loops & Spirals]], [[MoC - Modes]], [[MoC - Adaptation]]

**Schools (12):**
[[MoC - Neuroscience]], [[MoC - Predictive Processing]], [[MoC - Psychology]], [[MoC - Behavioral Science]], [[MoC - Psychotherapy]], [[MoC - Philosophy]], [[MoC - Buddhism]], [[MoC - Stoicism]], [[MoC - Christianity]], [[MoC - Hinduism]], [[MoC - Daoism]], [[MoC - New Age]]

**If content relates to a specific thinker not listed (e.g., Jung, Freud, ACT), use the parent School (Psychotherapy). If none fit well, omit the School rather than forcing a weak match.**

---

# COMPONENT SELECTION GUIDE

## Disambiguation Tests (use these to choose correctly):

### Embedded Map vs Symbolic Map — "Can you verbalize it?"
- **Symbolic Map**: Explicit, can be articulated, verbal reasoning, planning, stated beliefs
- **Embedded Map**: Implicit, bodily, "you just know", gut feelings, can't fully verbalize
- Drawing-from-prediction, intuitions, procedural knowledge = **Embedded Map**
- Frameworks, strategies, explicit goals = **Symbolic Map**

### Valuation vs Affect — "Signal or what it's about?"
- **Valuation**: What MATTERS — motivation, wanting, effort costs, priorities, "is this worth it?"
- **Affect**: The FEELING itself — emotions, mood, phenomenology of emotional experience
- "Why we procrastinate" (effort/reward) = **Valuation**
- "What anxiety feels like" = **Affect**

### Attention vs Awareness — "Spotlight or capacity for spotlight?"
- **Attention**: WHAT gets noticed — focus, salience, concentration, directing attention
- **Awareness**: CAPACITY to notice — consciousness, metacognition, witnessing, stepping back
- "How to focus better" = **Attention**
- "Observing your own thoughts" = **Awareness**

### State vs Affect — "Operating condition or emotional experience?"
- **State**: Physiological baseline — arousal, energy, fatigue, body's current condition
- **Affect**: Emotional coloring — feelings, moods, emotions
- "Being tired affects thinking" = **State**
- "Feeling sad" = **Affect**

### Prediction vs Embedded Map — "Specifically about expectation/surprise?"
- **Prediction**: Specifically about expectation-vs-reality, prediction error, surprise, forecasting
- **Embedded Map**: Broader implicit knowledge, cached evaluations
- Use Prediction when the note focuses on the expectation/error mechanism

### Memory vs Embedded Map — "Explicit recall or implicit knowledge?"
- **Memory**: Explicit storage/retrieval, "I remember that...", declarative memory
- **Embedded Map**: Implicit/procedural, "my body knows how to...", can't articulate
- Facts and episodes = **Memory**. Skills and intuitions = **Embedded Map**

### Self-Model — only when note is ABOUT selfhood
- Identity, "who am I", narrative self, self-concept, self-perception
- NOT just because the note is personal or self-referential

### Physical Substrate vs State — "Hardware or current condition?"
- **Physical Substrate**: The machinery — neurons, brain regions, neurotransmitters as mechanisms
- **State**: Current operating condition — tired, aroused, depleted
- "Dopamine signals reward" = **Physical Substrate**
- "Low energy state" = **State**

### Environment vs Social vs Culture
- **Environment**: Physical context, affordances, temperature, space
- **Social**: Other people, relationships, interpersonal dynamics
- **Culture**: Shared beliefs, norms, collective meaning-systems

---

# DYNAMICS SELECTION GUIDE

## The Interaction Test
**Dynamics require TWO parts interacting.** If note describes ONE thing, use Component only.

### Downward Flow vs Upward Flow — "What causes what?" (BE PRECISE ABOUT DIRECTION)

**Downward Flow** (Rider → Horse): Symbolic/cognitive content causes bodily/emotional/automatic changes
- Worry causing anxiety, visualization causing fear, rumination creating stress
- Mental rehearsal affecting heart rate, imagination triggering physical response
- **Imagination conditioning automatic behavior** — vivid mental rehearsal burning in habits, visualization training the body, imagined scenarios shaping automatic responses
- Mental content shaping what gets "compiled" into automatic execution
- The key: THOUGHT/IMAGINATION is the cause, BODY/EMOTION/AUTOMATIC BEHAVIOR is the effect
- If the note discusses how imagination, visualization, or mental rehearsal affects bodily patterns or habits, that's Downward Flow

**Upward Flow** (Horse → Rider): PHYSIOLOGICAL state affects what thoughts arise or get retrieved
- Tiredness causing pessimistic thoughts
- Anxiety state biasing memory retrieval toward threats
- Hunger making you irritable and short-tempered in thinking
- Low energy affecting what goals seem achievable
- The key: BODY STATE is the cause, THOUGHT CONTENT/RETRIEVAL is the effect

**NOT Upward Flow — these are something else:**
- Philosophical analysis of concepts → just Philosophy/Symbolic Map
- Goal fragmentation or future planning → Symbolic Map + Valuation
- Abstract discussions of freedom, meaning → Philosophy
- Metaphors about navigation or territory → Symbolic Map + Prediction
- Discussions of motivation types → Valuation

**The test:** Is there a PHYSIOLOGICAL/BODILY state (tired, anxious, hungry, energized) that is CAUSING different thoughts to arise or be retrieved? If not, don't use Upward Flow.

### Learning & Change — "Mechanism of HOW change happens?" (BE EXTREMELY STRICT)

**ONLY use Learning & Change when the note explains the MECHANISM at a causal level:**
- Conditioning (classical/operant), reinforcement schedules, variable ratio
- Habit formation loops (cue-routine-reward), habit stacking
- Knowing-doing gap — WHY insight doesn't produce behavior change
- Neuroplasticity, synaptic changes, Hebbian learning
- Exposure therapy mechanisms, extinction, reconsolidation
- Why training works but instruction doesn't

**NEVER use Learning & Change for these — use Symbolic Map instead:**
- Tables or lists comparing frameworks (PERMA, SDT, etc.)
- "Field guides" or reference summaries of approaches
- Task management or scheduling systems
- Lists of tips, practices, or strategies
- Descriptions of what works WITHOUT explaining WHY mechanistically
- Goal-setting or planning frameworks
- Navigation metaphors or prospection concepts

**The critical test:** Does the note explain the underlying MECHANISM (WHY something changes behavior at a causal/neural level)?
- "These 10 practices increase well-being" → **Symbolic Map** (lists practices)
- "Variable ratio reinforcement creates persistent behavior because dopamine fires on unpredictable rewards" → **Learning & Change** (explains mechanism)
- "Here's a table of flourishing frameworks" → **Symbolic Map** (reference material)
- "Habits form through cue-routine-reward loops that become automatic through basal ganglia chunking" → **Learning & Change** (explains mechanism)

### Loops & Spirals — "Does output feed back as input?"
- Must involve FEEDBACK — self-reinforcing patterns
- "Anxiety → avoidance → more anxiety" = YES (feedback loop)
- "X causes Y" (linear) = NO

### Modes — "Distinct configurations that SWITCH?"
- Different operating systems for different contexts
- System 1 vs System 2, IFS parts, work-mode vs play-mode
- NOT categorization, NOT planning, NOT "different types of X"

### Adaptation — "Old patterns that PERSIST?"
- Personality formation, defensive patterns, character armor, trauma responses
- Why patterns formed earlier stick around even when not adaptive
- NOT general change (that's Learning & Change)

## Common Dynamics Mistakes:
- "Pushing yourself leads to avoidance" = **Downward Flow** (thought → reaction)
- "Prioritizing goals" = **Symbolic Map** only (no Dynamic — it's just planning)
- "Different types of motivation" = **Valuation** only (categorization isn't a Dynamic)
- "Here's a productivity framework" = **Symbolic Map** only (no Learning & Change)
- "Table of flourishing frameworks" = **Symbolic Map** only (no Learning & Change — it's reference material)
- "Navigation as prospection metaphor" = **Symbolic Map + Prediction** (no Upward Flow — it's a metaphor)
- "Philosophical analysis of freedom" = **Philosophy** only (no Upward Flow — it's abstract analysis)
- "Goal fragmentation" = **Symbolic Map + Valuation** (no Upward Flow — it's about goals, not body→thought)

---

# SCHOOLS SELECTION GUIDE

## The Explicit Source Test
Schools should ONLY be applied when the note:
- Cites specific thinkers from that tradition
- Uses that tradition's specific vocabulary/frameworks
- Explicitly applies concepts from that discipline

## Common Mistakes:
- A business anecdote about focus ≠ Psychology
- A Napoleon quote about purpose ≠ Philosophy
- A note about emotions ≠ Psychology (unless citing psychological research)
- "Self-improvement" ≠ Psychotherapy (unless discussing therapeutic techniques)

## When to use each School (STRICT criteria):
- **Neuroscience**: MUST mention brain regions, neural circuits, or neurotransmitter mechanisms. Not just "the brain does X."
- **Psychology**: MUST cite psychological research, experiments, or specific psychologists (Kahneman, Baumeister, etc.). NOT just because it's about human behavior.
- **Predictive Processing**: MUST use PP-specific vocabulary: prediction error, precision-weighting, free energy, active inference, Bayesian brain. OR cite Friston, Clark, Seth, Hohwy. NOT just because it mentions "prediction."
- **Behavioral Science**: MUST discuss conditioning, reinforcement, Skinner, or behavioral economics specifically.
- **Psychotherapy**: MUST discuss specific therapeutic modalities (CBT, ACT, IFS, EMDR) or clinical interventions. NOT just "self-improvement."
- **Philosophy**: MUST engage with philosophical frameworks or cite philosophers. NOT just because it's reflective or about life.
- **Buddhism/Stoicism/etc.**: MUST use that tradition's specific concepts (Four Noble Truths, dichotomy of control, wu wei, etc.)

**Exception for iconic concepts:** If a note's central idea is unmistakably from one tradition (e.g., memento mori = Stoicism, non-attachment = Buddhism), include that School even without explicit citation.

**If unsure about Schools, OMIT them.** Components and Dynamics are sufficient. Schools are optional.

---

# META-PRINCIPLES

1. **Minimum viable tagging**: 1-3 Components is usually enough. Don't force Dynamics or Schools.
2. **Specificity over generality**: Pick the most specific match. Wanting/liking → Valuation, not Affect.
3. **The search test**: Would someone exploring this MoC want to find this note?
4. **Components are primary**: Every note needs ≥1 Component. Dynamics/Schools only when clearly applicable.
5. **When in doubt, omit**: Under-tagging is better than over-tagging. Wrong connections are worse than missing ones.
6. **Dynamics need interaction**: If note describes ONE thing, it's Component only.
7. **ONLY use MoC names from the provided list**: Do not invent new MoCs. If none fit well, omit rather than invent.
8. **Quote-only notes**: If a note is ONLY a quote with no analysis, use minimal MoC tags (1-2 Components max, no Dynamics unless clearly applicable).

---

# Output

Return ONLY the Connected section content in this format:

Component: [[MoC - Name]] | [[MoC - Name2]]
Dynamic: [[MoC - Name]]
School: [[MoC - Name]]

- Do NOT include the \`## Connected\` heading
- Do NOT include any other content from the note
- Do NOT wrap in code blocks
- ALWAYS include all three lines (Component, Dynamic, School) in that order
- If no MoCs apply for a category, leave it empty (e.g., "Dynamic:" with nothing after)`;

export function getCategorizeUserPrompt(filename: string, content: string): string {
  return `Analyze this note and generate the Connected section content.

Filename: ${filename}

---NOTE CONTENT---
${content}
---END NOTE---

REMEMBER:
- Use disambiguation tests to choose the RIGHT Component (Embedded vs Symbolic, Valuation vs Affect, etc.)
- Dynamics need INTERACTION between parts — don't add Dynamics for single-concept notes
- Schools need EXPLICIT source — Psychology requires citing research, Predictive Processing requires PP vocabulary
- Learning & Change = explains MECHANISM (conditioning, neuroplasticity, habit loops). Tables/lists/frameworks = Symbolic Map only
- Upward Flow = PHYSIOLOGICAL state causing thoughts (tired→pessimistic). Metaphors/philosophy/goals = NOT Upward Flow
- ONLY use MoC names from the provided list — NEVER invent new ones (no "MoC - Jung", use Psychotherapy instead)
- Quote-only notes: use minimal MoC tags (1-2 Components max)

Return ONLY the Connected section content (Component/Dynamic/School lines).`;
}

/**
 * Extracts the Connected section content from a GPT response.
 * Handles both full-file responses (with ## Connected heading) and direct content.
 * Always returns all three lines (Component, Dynamic, School) in order.
 */
export function extractConnectedSection(gptResponse: string): string {
  let rawContent = gptResponse;

  // Check for ## Connected heading and extract content after it
  const connectedMatch = gptResponse.match(/## Connected\s*\n([\s\S]*?)(?=\n##|\n---|\Z|$)/);
  if (connectedMatch) {
    rawContent = connectedMatch[1];
  }

  // Parse Component/Dynamic/School lines from the content
  const lines = rawContent.split('\n');
  let component = '';
  let dynamic = '';
  let school = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Component:')) {
      component = trimmed.substring('Component:'.length).trim();
    } else if (trimmed.startsWith('Dynamic:')) {
      dynamic = trimmed.substring('Dynamic:'.length).trim();
    } else if (trimmed.startsWith('School:')) {
      school = trimmed.substring('School:'.length).trim();
    }
  }

  // Always return all three lines in order
  return `Component: ${component}\nDynamic: ${dynamic}\nSchool: ${school}`;
}
