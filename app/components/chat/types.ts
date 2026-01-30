import type { DiagnosisPayload } from "@/types/chat";

import type { UIMessage } from "ai";

export type AssistantMessageWithEvidence = UIMessage & {
  metadata?: {
    evidence?: DiagnosisPayload;
  };
};
