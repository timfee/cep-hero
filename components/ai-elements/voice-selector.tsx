"use client";

import type { ComponentProps, ReactNode } from "react";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import {
  CircleSmallIcon,
  LoaderCircleIcon,
  MarsIcon,
  MarsStrokeIcon,
  NonBinaryIcon,
  PauseIcon,
  PlayIcon,
  TransgenderIcon,
  VenusAndMarsIcon,
  VenusIcon,
} from "lucide-react";
import { createContext, useContext, useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface VoiceSelectorContextValue {
  value: string | undefined;
  setValue: (value: string | undefined) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const VoiceSelectorContext = createContext<VoiceSelectorContextValue | null>(
  null
);

export const useVoiceSelector = () => {
  const context = useContext(VoiceSelectorContext);
  if (!context) {
    throw new Error(
      "VoiceSelector components must be used within VoiceSelector"
    );
  }
  return context;
};

export type VoiceSelectorProps = ComponentProps<typeof Dialog> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string | undefined) => void;
};

export const VoiceSelector = ({
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}: VoiceSelectorProps) => {
  const [value, setValue] = useControllableState({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: onValueChange,
  });

  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  });

  const voiceSelectorContext = useMemo(
    () => ({ value, setValue, open, setOpen }),
    [value, setValue, open, setOpen]
  );

  return (
    <VoiceSelectorContext.Provider value={voiceSelectorContext}>
      <Dialog onOpenChange={setOpen} open={open} {...props}>
        {children}
      </Dialog>
    </VoiceSelectorContext.Provider>
  );
};

export type VoiceSelectorTriggerProps = ComponentProps<typeof DialogTrigger>;

export const VoiceSelectorTrigger = (props: VoiceSelectorTriggerProps) => (
  <DialogTrigger {...props} />
);

export type VoiceSelectorContentProps = ComponentProps<typeof DialogContent> & {
  title?: ReactNode;
};

export const VoiceSelectorContent = ({
  className,
  children,
  title = "Voice Selector",
  ...props
}: VoiceSelectorContentProps) => (
  <DialogContent className={cn("p-0", className)} {...props}>
    <DialogTitle className="sr-only">{title}</DialogTitle>
    <Command className="**:data-[slot=command-input-wrapper]:h-auto">
      {children}
    </Command>
  </DialogContent>
);

export type VoiceSelectorDialogProps = ComponentProps<typeof CommandDialog>;

export const VoiceSelectorDialog = (props: VoiceSelectorDialogProps) => (
  <CommandDialog {...props} />
);

export type VoiceSelectorInputProps = ComponentProps<typeof CommandInput>;

export const VoiceSelectorInput = ({
  className,
  ...props
}: VoiceSelectorInputProps) => (
  <CommandInput className={cn("h-auto py-3.5", className)} {...props} />
);

export type VoiceSelectorListProps = ComponentProps<typeof CommandList>;

export const VoiceSelectorList = (props: VoiceSelectorListProps) => (
  <CommandList {...props} />
);

export type VoiceSelectorEmptyProps = ComponentProps<typeof CommandEmpty>;

export const VoiceSelectorEmpty = (props: VoiceSelectorEmptyProps) => (
  <CommandEmpty {...props} />
);

export type VoiceSelectorGroupProps = ComponentProps<typeof CommandGroup>;

export const VoiceSelectorGroup = (props: VoiceSelectorGroupProps) => (
  <CommandGroup {...props} />
);

export type VoiceSelectorItemProps = ComponentProps<typeof CommandItem>;

export const VoiceSelectorItem = ({
  className,
  ...props
}: VoiceSelectorItemProps) => (
  <CommandItem className={cn("px-4 py-2", className)} {...props} />
);

export type VoiceSelectorShortcutProps = ComponentProps<typeof CommandShortcut>;

export const VoiceSelectorShortcut = (props: VoiceSelectorShortcutProps) => (
  <CommandShortcut {...props} />
);

export type VoiceSelectorSeparatorProps = ComponentProps<
  typeof CommandSeparator
>;

export const VoiceSelectorSeparator = (props: VoiceSelectorSeparatorProps) => (
  <CommandSeparator {...props} />
);

export type VoiceSelectorGenderProps = ComponentProps<"span"> & {
  value?:
    | "male"
    | "female"
    | "transgender"
    | "androgyne"
    | "non-binary"
    | "intersex";
};

export const VoiceSelectorGender = ({
  className,
  value,
  children,
  ...props
}: VoiceSelectorGenderProps) => {
  let icon: ReactNode | null = null;

  switch (value) {
    case "male": {
      icon = <MarsIcon className="size-4" />;
      break;
    }
    case "female": {
      icon = <VenusIcon className="size-4" />;
      break;
    }
    case "transgender": {
      icon = <TransgenderIcon className="size-4" />;
      break;
    }
    case "androgyne": {
      icon = <MarsStrokeIcon className="size-4" />;
      break;
    }
    case "non-binary": {
      icon = <NonBinaryIcon className="size-4" />;
      break;
    }
    case "intersex": {
      icon = <VenusAndMarsIcon className="size-4" />;
      break;
    }
    default: {
      icon = <CircleSmallIcon className="size-4" />;
    }
  }

  return (
    <span className={cn("text-muted-foreground text-xs", className)} {...props}>
      {children ?? icon}
    </span>
  );
};

export type VoiceSelectorAccentProps = ComponentProps<"span"> & {
  value?:
    | "american"
    | "british"
    | "australian"
    | "canadian"
    | "irish"
    | "scottish"
    | "indian"
    | "south-african"
    | "new-zealand"
    | "spanish"
    | "french"
    | "german"
    | "italian"
    | "portuguese"
    | "brazilian"
    | "mexican"
    | "argentinian"
    | "japanese"
    | "chinese"
    | "korean"
    | "russian"
    | "arabic"
    | "dutch"
    | "swedish"
    | "norwegian"
    | "danish"
    | "finnish"
    | "polish"
    | "turkish"
    | "greek"
    | string;
};

export const VoiceSelectorAccent = ({
  className,
  value,
  children,
  ...props
}: VoiceSelectorAccentProps) => {
  let accentLabel: string | null = null;

  switch (value) {
    case "american": {
      accentLabel = "US";
      break;
    }
    case "british": {
      accentLabel = "UK";
      break;
    }
    case "australian": {
      accentLabel = "AU";
      break;
    }
    case "canadian": {
      accentLabel = "CA";
      break;
    }
    case "irish": {
      accentLabel = "IE";
      break;
    }
    case "scottish": {
      accentLabel = "SC";
      break;
    }
    case "indian": {
      accentLabel = "IN";
      break;
    }
    case "south-african": {
      accentLabel = "ZA";
      break;
    }
    case "new-zealand": {
      accentLabel = "NZ";
      break;
    }
    case "spanish": {
      accentLabel = "ES";
      break;
    }
    case "french": {
      accentLabel = "FR";
      break;
    }
    case "german": {
      accentLabel = "DE";
      break;
    }
    case "italian": {
      accentLabel = "IT";
      break;
    }
    case "portuguese": {
      accentLabel = "PT";
      break;
    }
    case "brazilian": {
      accentLabel = "BR";
      break;
    }
    case "mexican": {
      accentLabel = "MX";
      break;
    }
    case "argentinian": {
      accentLabel = "AR";
      break;
    }
    case "japanese": {
      accentLabel = "JP";
      break;
    }
    case "chinese": {
      accentLabel = "CN";
      break;
    }
    case "korean": {
      accentLabel = "KR";
      break;
    }
    case "russian": {
      accentLabel = "RU";
      break;
    }
    case "arabic": {
      accentLabel = "AR";
      break;
    }
    case "dutch": {
      accentLabel = "NL";
      break;
    }
    case "swedish": {
      accentLabel = "SE";
      break;
    }
    case "norwegian": {
      accentLabel = "NO";
      break;
    }
    case "danish": {
      accentLabel = "DK";
      break;
    }
    case "finnish": {
      accentLabel = "FI";
      break;
    }
    case "polish": {
      accentLabel = "PL";
      break;
    }
    case "turkish": {
      accentLabel = "TR";
      break;
    }
    case "greek": {
      accentLabel = "GR";
      break;
    }
    default: {
      accentLabel = null;
    }
  }

  return (
    <span className={cn("text-muted-foreground text-xs", className)} {...props}>
      {children ?? accentLabel}
    </span>
  );
};

export type VoiceSelectorAgeProps = ComponentProps<"span">;

export const VoiceSelectorAge = ({
  className,
  ...props
}: VoiceSelectorAgeProps) => (
  <span
    className={cn("text-muted-foreground text-xs tabular-nums", className)}
    {...props}
  />
);

export type VoiceSelectorNameProps = ComponentProps<"span">;

export const VoiceSelectorName = ({
  className,
  ...props
}: VoiceSelectorNameProps) => (
  <span
    className={cn("flex-1 truncate text-left font-medium", className)}
    {...props}
  />
);

export type VoiceSelectorDescriptionProps = ComponentProps<"span">;

export const VoiceSelectorDescription = ({
  className,
  ...props
}: VoiceSelectorDescriptionProps) => (
  <span className={cn("text-muted-foreground text-xs", className)} {...props} />
);

export type VoiceSelectorAttributesProps = ComponentProps<"div">;

export const VoiceSelectorAttributes = ({
  className,
  children,
  ...props
}: VoiceSelectorAttributesProps) => (
  <div className={cn("flex items-center text-xs", className)} {...props}>
    {children}
  </div>
);

export type VoiceSelectorBulletProps = ComponentProps<"span">;

export const VoiceSelectorBullet = ({
  className,
  ...props
}: VoiceSelectorBulletProps) => (
  <span
    aria-hidden="true"
    className={cn("select-none text-border", className)}
    {...props}
  >
    &bull;
  </span>
);

export type VoiceSelectorPreviewProps = Omit<
  ComponentProps<"button">,
  "children"
> & {
  playing?: boolean;
  loading?: boolean;
  onPlay?: () => void;
};

export const VoiceSelectorPreview = ({
  className,
  playing,
  loading,
  onPlay,
  onClick,
  ...props
}: VoiceSelectorPreviewProps) => {
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClick?.(event);
    onPlay?.();
  };

  let icon = <PlayIcon className="size-3" />;

  if (loading) {
    icon = <LoaderCircleIcon className="size-3 animate-spin" />;
  } else if (playing) {
    icon = <PauseIcon className="size-3" />;
  }

  return (
    <Button
      aria-label={playing ? "Pause preview" : "Play preview"}
      className={cn("size-6", className)}
      disabled={loading}
      onClick={handleClick}
      size="icon-sm"
      type="button"
      variant="outline"
      {...props}
    >
      {icon}
    </Button>
  );
};
