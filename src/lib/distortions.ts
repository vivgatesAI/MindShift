export const COGNITIVE_DISTORTIONS = [
  { id: 'all-or-nothing', label: 'All-or-Nothing Thinking', emoji: '⚫⚪', description: 'Seeing things in black and white with no middle ground' },
  { id: 'catastrophizing', label: 'Catastrophizing', emoji: '🌪️', description: 'Expecting the worst possible outcome' },
  { id: 'mind-reading', label: 'Mind Reading', emoji: '🔮', description: 'Assuming you know what others are thinking' },
  { id: 'should-statements', label: 'Should Statements', emoji: '📋', description: 'Rigid rules about how things must be' },
  { id: 'personalization', label: 'Personalization', emoji: '🎯', description: 'Blaming yourself for things outside your control' },
  { id: 'overgeneralization', label: 'Overgeneralization', emoji: '🔁', description: 'Drawing broad conclusions from a single event' },
  { id: 'emotional-reasoning', label: 'Emotional Reasoning', emoji: '💊', description: 'Believing something is true because it feels true' },
  { id: 'filtering', label: 'Mental Filtering', emoji: '🔍', description: 'Only seeing the negative aspects of a situation' },
  { id: 'labeling', label: 'Labeling', emoji: '🏷️', description: 'Attaching a fixed label to yourself or others' },
  { id: 'magnification', label: 'Magnification/Minimization', emoji: '🔬', description: 'Blowing things out of proportion or shrinking their importance' },
] as const;

export type DistortionId = typeof COGNITIVE_DISTORTIONS[number]['id'];