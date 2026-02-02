"use client";

import { Building2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="grid gap-3 sm:grid-cols-2">
      {orgUnits.map((ou) => (
        <Card key={ou.orgUnitId} className="bg-muted/50">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              {ou.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid gap-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Path:</span>
                <span className="font-mono text-foreground">
                  {ou.orgUnitPath}
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
  );
}
