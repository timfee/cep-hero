/**
 * Image component for displaying AI-generated images from base64 data.
 */
import type { Experimental_GeneratedImage } from "ai";

import { cn } from "@/lib/utils";

export type ImageProps = Experimental_GeneratedImage & {
  className?: string;
  alt?: string;
};

/**
 * Renders a base64-encoded image with rounded corners and responsive sizing.
 */
export const Image = ({
  base64,
  uint8Array: _uint8Array,
  mediaType,
  ...props
}: ImageProps) => (
  <img
    {...props}
    alt={props.alt}
    className={cn(
      "h-auto max-w-full overflow-hidden rounded-md",
      props.className
    )}
    src={`data:${mediaType};base64,${base64}`}
  />
);
