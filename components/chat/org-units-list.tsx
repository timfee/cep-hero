/**
 * Organizational units list component for displaying Google Workspace org unit data.
 * Renders a collapsed summary by default with an expandable grid of OU cards.
 */

"use client";

import { Building2, ChevronDownIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface OrgUnit {
  orgUnitId?: string;
  name?: string;
  orgUnitPath?: string;
  parentOrgUnitId?: string;
  description?: string;
}

interface OrgUnitsListProps {
  data: {
    orgUnits?: OrgUnit[];
  };
}

/**
 * Displays org units as a collapsed summary with expandable detail grid.
 * Starts collapsed to avoid flooding the chat with a large OU tree.
 */
export function OrgUnitsList({ data }: OrgUnitsListProps) {
  const orgUnits = data?.orgUnits || [];

  if (orgUnits.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No organizational units found.
      </div>
    );
  }

  return (
    <Collapsible className="group">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border p-3 text-sm transition-colors hover:bg-muted/50">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">
          {orgUnits.length} organizational unit{orgUnits.length !== 1 && "s"}
        </span>
        <ChevronDownIcon className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {orgUnits.map((ou) => (
            <Card key={ou.orgUnitId} className="bg-muted/50">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {ou.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="grid gap-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {ou.orgUnitPath ?? "/"}
                    </span>
                  </div>
                  {ou.description && (
                    <div className="mt-1 line-clamp-2">{ou.description}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
