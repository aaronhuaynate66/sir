export const EVENTS = {
  // Onboarding
  USER_SIGNED_UP:            'user_signed_up',
  USER_COMPLETED_ONBOARDING: 'user_completed_onboarding',
  LANGUAGE_SELECTED:         'language_selected',
  // Personas
  PERSON_CREATED:      'person_created',
  PERSON_VIEWED:       'person_viewed',
  SCREENSHOT_ANALYZED: 'screenshot_analyzed',
  SCREENSHOT_SAVED:    'screenshot_saved',
  // Briefing
  BRIEFING_GENERATED:   'briefing_generated',
  BRIEFING_REGENERATED: 'briefing_regenerated',
  BRIEFING_VIEWED:      'briefing_viewed',
  // Signals
  SIGNAL_CREATED:  'signal_created',
  SIGNAL_ACTED_ON: 'signal_acted_on',
  // Memory
  MEMORY_STORED:   'memory_stored',
  MEMORY_RECALLED: 'memory_recalled',
  // Human State
  STATE_LOGGED:          'state_logged',
  CYCLE_DATA_UPDATED:    'cycle_data_updated',
  SYMPTOM_LOGGED:        'symptom_logged',
  // Graph
  GRAPH_VIEWED:   'graph_viewed',
  GRAPH_FILTERED: 'graph_filtered',
  NODE_HOVERED:   'node_hovered',
  // Engagement
  INTERACTION_REGISTERED: 'interaction_registered',
  SIDEBAR_NAV:            'sidebar_nav',
} as const;

export type EventName = typeof EVENTS[keyof typeof EVENTS];
