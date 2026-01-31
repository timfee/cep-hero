import type { UIMessage } from "ai";

import type { DiagnosisPayload } from "@/types/chat";

export type AssistantMessageWithEvidence = UIMessage & {
  metadata?: {
    evidence?: DiagnosisPayload;
  };
};
