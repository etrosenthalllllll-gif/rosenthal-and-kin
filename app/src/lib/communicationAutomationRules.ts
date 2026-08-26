// Communications automation rule engine -- doc 04 sections 9, 29, 30.
// PLAN.md P3-5.
//
// "Rules should be able to evaluate: Case state, Person status,
// Communication type, Channel, AI classification, Confidence, Previous
// communication, Opt-out status, Time since last communication,
// Workflow state, Pending decision, Exceptions, Required documents,
// Operator instructions. Then determine: Respond automatically, Create
// decision, Escalate, Schedule follow-up, Update case, Stop
// communications, Do nothing. Rules should be configurable."
//
// This is the central decision layer that composes the three engines
// already built this phase rather than re-implementing any of their
// logic: P3-4's routeClassifiedCommunication() (classification
// confidence routing), P3-6's canSendOnChannel() (opt-out enforcement),
// and doc 04 section 30's human-takeover flag. No new business rule is
// invented here beyond how those three interact and in what order --
// which is itself doc 04's point: this module is precisely "the
// evaluator," not a new source of truth for any individual signal.

import {
  routeClassifiedCommunication,
  type ClassificationResult,
} from "./communicationClassification";
import {
  canSendOnChannel,
  type PersonCommunicationPreferences,
} from "./communicationPreferences";
import type { CommunicationChannel } from "./communicationTimeline";

export type AutomationAction =
  | "RESPOND_AUTOMATICALLY"
  | "CREATE_DECISION"
  | "STOP_COMMUNICATIONS"
  | "ESCALATE"
  | "DO_NOTHING";

export interface AutomationRuleInput {
  classification: ClassificationResult;
  preferences: PersonCommunicationPreferences;
  channel: CommunicationChannel;
  // doc 04 section 30: "When an operator takes over a conversation: Set
  // HUMAN_HANDLING = TRUE. Pause conflicting automation." Sourced from
  // Conversation.humanHandling (P3-1 schema).
  humanHandling: boolean;
}

export interface AutomationRuleDecision {
  action: AutomationAction;
  reason: string;
}

const OPT_OUT_CATEGORIES = new Set(["DO_NOT_CONTACT", "UNSUBSCRIBE"]);

/**
 * Pure: the single evaluator every inbound-communication pipeline calls
 * once a message has a classification result. No DB access. Precedence,
 * in order (each doc 04 section noted at its check):
 *
 * 1. A human already owns this conversation (section 30) -> automation
 *    stays out of the way entirely, no decision, no response.
 * 2. The message itself IS an opt-out signal (sections 6, 19) ->
 *    honoring it is itself the automated action; it does not need a
 *    human decision to process a stop request.
 * 3. The classifier says this category/confidence needs a human
 *    (section 6/9/28, via P3-4) -> create a decision.
 * 4. The classifier says automation is safe, but the person is already
 *    opted out on this channel (section 19, via P3-6) -> that's a
 *    contradiction worth a human's attention, not a silent no-op, so it
 *    escalates rather than either sending (which section 19 forbids) or
 *    disappearing (section 44: "never silently disappear").
 * 5. Otherwise -> respond automatically.
 */
export function decideAutomationAction(
  input: AutomationRuleInput
): AutomationRuleDecision {
  if (input.humanHandling) {
    return {
      action: "DO_NOTHING",
      reason: "An operator already owns this conversation; automation is paused.",
    };
  }

  if (OPT_OUT_CATEGORIES.has(input.classification.category)) {
    return {
      action: "STOP_COMMUNICATIONS",
      reason: `Message classified as ${input.classification.category}; processing the opt-out is the automated action.`,
    };
  }

  const routing = routeClassifiedCommunication(input.classification);
  if (routing.route === "HUMAN_REVIEW") {
    return { action: "CREATE_DECISION", reason: routing.reason };
  }

  const permission = canSendOnChannel(input.preferences, input.channel);
  if (!permission.allowed) {
    return {
      action: "ESCALATE",
      reason: `Classification would allow an automated response, but sending is blocked: ${permission.reason}`,
    };
  }

  return {
    action: "RESPOND_AUTOMATICALLY",
    reason: routing.reason,
  };
}
